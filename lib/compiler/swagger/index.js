'use strict';

let _           = require('lodash');
let jsonRefs    = require('json-refs');
let deasync     = require('deasync');
let traverse    = require('traverse');
let resolveRefs = deasync(jsonRefs.resolveRefs);

let Swagger = function (object, options) {
  let self           = this;
  self._original_    = _.clone(object, true);
  self.parserVersion = 'Generic';

  let opts = options || {};

  // resolve relative links
  let obj = resolveRefs(object, opts);
  traverse(obj).forEach(function (prop) {
    if (prop !== null && prop.allOf) {
      let inPlace = {};
      _.each(prop.allOf, function (oneOf) {
        inPlace = _.defaults(oneOf, inPlace);
      });

      let accessor = this;
      accessor.update(inPlace);
    }
  });
  // build definitions

  _.extend(this, obj);

  this.setRouteValidationMap();
  this.setSanitizedRoutes();
  this.setControllers();
  return this;

};

Swagger.prototype.setControllers = function () {
  let controllers = {};

  _.each(this.paths, function (controllerConfig, controllerPath) {
    controllers = _.merge(controllers, constructController(controllerConfig, controllerPath));
  });

  function constructController(controllerConfig, controllerPath) {
    let method                     = _.keys(controllerConfig)[0];
    let methodObj                  = {};
    methodObj[method]              = controllerConfig[method];
    let routeObj                   = {};
    routeObj[controllerPath]       = methodObj;
    let controllerFile             = {};
    let controllerName             = controllerConfig[method]['x-controller'];
    controllerFile[controllerName] = routeObj;

    return controllerFile;
  }

  this.controllers = controllers;
};

Swagger.prototype.setSanitizedRoutes = function () {
  let routes = [];

  _.each(this.paths, function (pathConfig, pathRoute) {
    _.each(pathConfig, constructPathObj(pathRoute));
  });

  function constructPathObj (pathRoute) {
    return function (endpointConfig, methodType) {
      try {
        if (_.isString(pathRoute) && _.isString(methodType) && _.isString(endpointConfig['x-controller'])) {
          routes.push({
            path         : pathRoute,
            method       : methodType.toLowerCase(),
            controller   : endpointConfig['x-controller'],
            authRequired : !!(_.includes(endpointConfig.tags, 'authenticated')),
            restricted   : !!(_.includes(endpointConfig.tags, 'restricted')),
            details      : endpointConfig
          });
        } else {
          throw new Error('Invalid route configuration');
        }
      } catch (e) {
        console.error('Ignored route: (' + methodType + ' ' + pathRoute + ') because of error');
      }
    };
  }

  this.sanitizedRoutes =  routes;
};


Swagger.prototype.setRouteValidationMap = function () {
  let routeMap = {};

  _.each(this.paths, function (pathConfig, pathRoute) {
    _.each(pathConfig, constructPathObj(pathRoute));
  });

  function constructPathObj (pathRoute) {
    return function (endpointConfig, methodType) {
      try {
        if (_.isString(pathRoute) && _.isString(methodType) && _.isString(endpointConfig['x-controller'])) {
          routeMap[pathRoute] = routeMap[pathRoute]  || {};
          routeMap[pathRoute][methodType.toLowerCase()] = endpointConfig.parameters || [];


        } else {
          throw new Error('Invalid route configuration');
        }
      } catch (e) {
        console.error('Ignored route: (' + methodType + ' ' + pathRoute + ') because of error');
        console.error(e.stack);
      }
    };
  }

  this.routeValidationMap = routeMap;
};

//
// parser.find(query);
//
// `.` delimited with array index support `[`INDEX`]`
Swagger.prototype.find = function (query, obj) {
  let querySplit = (query || '').split('.');
  let result     = obj || this;
  let depthCount = 0;

  try {
    _.each(querySplit, function (propName) {

      // check for arrays
      if (/\[\d\]/.test(propName)) {
        let leadMatch    = propName.match(/^(.*?)\[/) || [];
        let trailMatch   = propName.match(/.*\](.*)$/) || [];
        let leadingProp  = leadMatch[1];
        let trailingProp = trailMatch[1];
        let arrOnly      = propName.replace(leadingProp, '');
        arrOnly          = arrOnly.replace(trailingProp, '');
        arrOnly          = _.compact(arrOnly.replace(/\[/g, '').split(']'));

        result = result[leadingProp];
        _.each(arrOnly, function (index) { result = result[parseInt(index, 10)]; });

        result = trailingProp ? result[trailingProp] : result;

      // simple prop
      } else {
        result = result[propName];
      }
    });
  } catch (e) {
    result = undefined;
  }

  return result;
};

//
// parser.applyProperties(swaggerObj)
//
Swagger.prototype.applyProperties = function (obj) {
  let self = this;

  let recursiveApply = function (currentSelf, currentProp, currentSchema) {
    // apply defaults for the current property
    _.each(currentSchema || [], function (currentValue, currentKey) {
      currentSelf[currentKey] = currentSchema[currentKey];
    });

    // apply overrides for current property
    _.each(currentProp || [], function (currentValue, currentKey) {
      if (currentProp && (currentProp[currentKey] !== 'undefined')) {
        currentSelf[currentKey] = currentProp[currentKey];
      }
    });

    // recurse for each property
    _.each(currentSelf, function (currentValue, currentKey) {
      let schemaPropToPass  = currentSchema && (typeof currentSchema[currentKey] !== 'undefined') ? currentSchema[currentKey] : undefined;
      let currentPropToPass = currentProp && (typeof currentProp[currentKey] !== 'undefined') ? currentProp[currentKey] : undefined;

      // if the schema or obj has a value
      if (typeof schemaPropToPass !== 'undefined' || typeof currentPropToPass !== 'undefined') {
        recursiveApply(currentSelf[currentKey], currentPropToPass, currentPropToPass);
      }
    });
  };

  recursiveApply(self, (obj || {}), schema.base);
};


//
// routeSet
//
Swagger.prototype.routeSet = function () {
  return [];
};

module.exports = Swagger;
