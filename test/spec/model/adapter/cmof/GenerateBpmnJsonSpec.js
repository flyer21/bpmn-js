var fs = require('fs');
var _ = require('lodash');

var Helper = require('../../../Helper');
var Parser = require('moddle/lib/adapter/cmof/Parser');


Helper.ensureDirExists('resources/bpmn/json');

describe('generate JSON meta model', function() {

  function parsed(file, callback, options) {
    return function(done) {
      new Parser({ clean: true }).parseFile(file, function(err, results) {
        if (err) {
          done(err);
        } else {
          try {
            callback(results, options);
            done();
          } catch (e) {
            done(e);
          }
        }
      });
    };
  }

  function swapProperties(desc, prop1, prop2) {
    var props = desc.properties;

    function findProperty(name) {
      return _.find(props, function(d) {
        return d.name === name;
      });
    }

    var p1 = findProperty(prop1);
    var p2 = findProperty(prop2);

    var idx1 = props.indexOf(p1);
    var idx2 = props.indexOf(p2);

    props[idx1] = p2;
    props[idx2] = p1;
  }

  function exportAsJson(results, options) {

    var elementsById = results.byId,
        pkg = elementsById['_0'];

    if (options) {
      if (options.alias) {
        pkg.alias = options.alias;
      }
    }

    var str = JSON.stringify(pkg, null, '  ');

    _.forEach(results.preSerialize, function(fn) {
      str = fn(str);
    });

    fs.writeFileSync('resources/bpmn/json/' + pkg.prefix + '.json', str);
  }

  function preSerialize(results, fn) {
    (results.preSerialize = results.preSerialize || []).push(fn);
  }

  function rename(results, oldType, newType) {
    preSerialize(results, function(str) {
      return str.replace(new RegExp(oldType, 'g'), newType);
    });
  }

  function alter(results, elementName, extension) {

    var elementParts = elementName.split('#');

    var elementsById = results.byId;

    var element = elementsById[elementParts[0]];

    if (!element) {
      throw new Error('[transform] element <' + elementParts[0] + '> does not exist');
    }

    if (elementParts[1]) {
      var property = _.find(element.properties, function(p) {
        return p.name == elementParts[1];
      });

      if (!property) {
        throw new Error('[transform] property <' + elementParts[0] + '#' + elementParts[1] + '> does not exist');
      }

      if (_.isFunction(extension)) {
        extension.call(element, property);
      } else {
        _.extend(property, extension);
      }
    } else {
      if (_.isFunction(extension)) {
        extension.call(element, element);
      } else {
        _.extend(element, extension);
      }
    }
  }

  it('should transform BPMN20.cmof', parsed('resources/bpmn/cmof/BPMN20.cmof', function(results) {

    rename(results, 'extensionAttributeValue', 'extensionElements');

    rename(results, 'ExtensionAttributeValue', 'ExtensionElements');

    alter(results, 'FlowElementsContainer', function(desc) {
      swapProperties(desc, 'laneSets', 'flowElements');
    });

    alter(results, 'FlowNode', function(desc) {
      swapProperties(desc, 'targetRef', 'sourceRef');
      swapProperties(desc, 'incoming', 'outgoing');
    });

    alter(results, 'DataAssociation', function(desc) {
      swapProperties(desc, 'targetRef', 'sourceRef');
    });

    alter(results, 'Documentation#text', {
      isBody: true
    });

    alter(results, 'ConditionalEventDefinition#condition', {
      serialize: 'xsi:type'
    });

    alter(results, 'TextAnnotation#text', function(desc) {
      delete desc.isAttr;
    });

    alter(results, 'DataAssociation#targetRef', function(desc) {
      delete desc.isAttr;
    });

    alter(results, 'Lane#flowNodeRefs', {
      name: 'flowNodeRef'
    });

    exportAsJson(results, { alias: 'lowerCase' });
  }));

  it('should transform BPMNDI.cmof', parsed('resources/bpmn/cmof/BPMNDI.cmof', exportAsJson));

  it('should transform DI.cmof', parsed('resources/bpmn/cmof/DI.cmof', function(results) {
    
    alter(results, 'Edge#waypoint', {
      serialize: 'xsi:type'
    });

    exportAsJson(results);
  }));

  it('should transform DC.cmof', parsed('resources/bpmn/cmof/DC.cmof', exportAsJson));
});