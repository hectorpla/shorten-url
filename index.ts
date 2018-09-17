// import * as express from 'express';
import express = require('express');
import mysql = require('mysql');
import bodyParser = require('body-parser');
import dns = require('dns');

import util = require('./util');
const { findValidHash, searchShortUrl, insertURL } = util;

require('dotenv').config();

const app = express();
const apiRounter = express.Router();

// const DBName = 'URL';
const TABLE_NAME = 'ShortURL';

const mysqlConnection = mysql.createConnection({
  host: process.env.HOST_NAME,
  user: process.env.ACCOUNT,
  password: process.env.PASSWORD,
  database: process.env.DB_NAME
});
mysqlConnection.connect();

// TODO: should finish before any request
mysqlConnection.query(`CREATE TABLE ${TABLE_NAME} (Hash VARCHAR(16), OriginalURL VARCHAR(512), ExpirationDate DATETIME)`,
  function (err: any) {
    if (err.errno == 1050) {
      console.log('table already exists');
    } else {
      throw err;
    }
  });

interface ErrorMessage {
  original_url: string;
  success: boolean;
}
function errorHandler(err: any, longUrl: string): ErrorMessage {
  console.log('shorten url error:', err.errno || err);
  return {
    original_url: longUrl,
    success: false,
  };
}

apiRounter.post('/shorturl/new', bodyParser.text({ type: "text/plain" }),
  function (req, res) {
    const url = req.body as string;
    console.log("body:", url);

    const trimmedUrl = url.replace(/(^\w+:|^)\/\//, '');
    // TODO: promisify this lookup procedure
    dns.lookup(trimmedUrl, function (err, address, family) {
      console.log('address: %j family: IPv%s', address, family);
      if (err) {
        // console.log('dns lookup error:', err.code);
        return res.json({
          ...errorHandler(err, url),
          message: 'bad url'
        });
      }

      const searchPromise = searchShortUrl(mysqlConnection, TABLE_NAME);

      const generationPromise = findValidHash(function(hash) {
        return searchPromise(hash).then(function(results) {
          return results.length == 0;
        })
      });

      const insertPromise = generationPromise.then(function (hash) {
        return insertURL({
          connection: mysqlConnection,
          tableName: TABLE_NAME,
          shortUrl: hash,
          longUrl: url
        })
      });

      insertPromise.then(function (result) {
        res.json({
          original_url: result.longUrl,
          short_url: result.shortUrl,
          success: true
        });
      }).catch(function (err) {
        res.json(errorHandler(err, url));
      });
    });
  });

apiRounter.get('/shorturl/:locator', function (req, res) {
  // TODO 1. search in db, 2. redirect if exist
  const searchPromise = searchShortUrl(mysqlConnection, TABLE_NAME);
  const locator = req.params.locator;
  searchPromise(locator).then(function(results) {
    if (results.length == 0) {
      res.json({
        locator,
        success: false
      })
    } else {
      console.log(results);
      // res.json(results[0]);
      res.redirect(results[0].OriginalURL);
    }
  }).catch(function(err) {
    console.log(err);
    res.json({
      locator,
      success: false
    })
  });
});

app.use('/api', apiRounter);

app.use((req, res) => res.end("shorten-url-service"));
app.listen(3000, () => console.log('listening...'));
