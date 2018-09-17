import { Connection } from "mysql";

const charpool = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * generate 62-based random string
 * TODO: didn't deal with duplicates for long urls
 * @param size length for the string
 */
function genRandomString(size: number): string {
  const chars = [];
  for (let i = 0; i < size; i++) {
    chars.push(charpool.charAt(Math.random() * 62));
  }
  return chars.join('');
}

/**
 * a higher order function that generates query results for selecting short url in the db
 * @param connection 
 * @param tableName 
 * @returns a function that generates promise of boolean representing if the short url is in the database
 */
function searchShortUrl(connection: Connection, tableName: string) {
  return function (shortUrl: string): Promise<boolean> {
    return new Promise(function (resolve, reject) {
      connection.query(`SELECT Hash FROM ${tableName} WHERE Hash = "${shortUrl}"`,
        function (err, results, fields) {
          if (err) { reject(err); }
          console.log("searching hash in table (results, fields, empty)", results, fields, results.length == 0);
          
          resolve(results.length == 0);
        });
    })
  }
}

/**
 * repeatly generate short url until the condition in `checker` is satified
 * @param checker a function that will be performed after every geneartion of short url
 */
async function findValidHash(checker: (url: string) => Promise<boolean>): Promise<string> {
  let hash;
  let sucess = false;
  do {
    hash = genRandomString(6);
    try {
      sucess = await checker(hash);
      console.log(sucess);
    } catch(err) {
      return Promise.reject(err);
    }
  } while (!sucess);
  return Promise.resolve(hash);
}

interface InsertOption {
  connection: Connection;
  tableName: string;
  shortUrl: string;
  longUrl: string;
}

interface UrlPair {
  shortUrl: string;
  longUrl: string;
}

/**
 * a wrapper for insert operation
 * @param option 
 */
function insertURL(option: InsertOption): Promise<UrlPair> {
  const { connection, tableName, shortUrl, longUrl } = option;
  return new Promise(function (resolve, reject) {
    connection.query(`INSERT INTO ${tableName}(Hash, OriginalURL, ExpirationDate) VALUES("${shortUrl}", "${longUrl}", NOW())`,
      function (err, results, fields) {
        if (err) {
          reject(err);
        } else {
          resolve({
            shortUrl,
            longUrl
          });
        }
      });
  }) as Promise<UrlPair>;
}

export = {
  searchShortUrl,
  findValidHash,
  insertURL
}
