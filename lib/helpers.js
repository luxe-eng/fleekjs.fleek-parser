'use strict'

var _ = require('lodash');
var fs      = require('fs')
var yaml    = require('js-yaml');

//
// Path to absolute
//
// normalize both relative and absolute paths to be absolue (relative start with `.`)
//
// Parameters:
//   basePath
//     [String] - base path to resolve relative paths
//
//   initPath
//     [String] - path to build to, abolute or relative
//
//
exports.pathToAbsolute = function (basePath, initPath) {
  if (!(_.isString(basePath) && _.isString(initPath))) { throw Error('pathtoAbsolute requires both basePath and initPath to be strings'); }

  var result = null;

  // relative
  if (~initPath.indexOf('.')) {
    let pathSplit = initPath.split('/')
    pathSplit.shift();
    initPath = pathSplit.join('/');
    initPath = initPath.indexOf('/') === 0 ? initPath : '/' + initPath;
    result   = basePath + initPath;

  // absolute
  } else {
    result = initPath;
  }

  return result;
}


//
// Interpret Swagger
//
// convert the swagger into a valid json object
//
// Parameters:
//   swagger
//     [Mixed] - swagger object to interpret (string path, string json, object)
//
//
module.exports.inpterpretSwagger = function (swagger) {
  // Path or JSON string
  if (_.isString(swagger)) {

    // Resolve path
    if (swagger.indexOf('{') !== 0) {
      let path = exports.pathToAbsolute(process.cwd(), swagger) || '';
      path = /\.json$/.test(path) ? path : path + '.json';
      try {
//        swagger = require(path); // JSON
        swagger = yaml.safeLoad(fs.readFileSync(path, 'utf8')); // YAML
      } catch (e) {
        // console.log(e.stack);
        throw Error('failed to load swagger file: ' + path);
      }
    }
    swagger = _.isString(swagger) ? JSON.parse(swagger) : swagger;
  }

  // Object
  if (_.isObject(swagger)) {
    return swagger;
  } else {
    throw Error('Failed to interpret swagger docs');
  }
}
