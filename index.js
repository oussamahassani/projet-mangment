#! /usr/bin/env node


const fs = require('fs');
const path = require('path');
const extractMongoSchema = require('./extract-mongo-schema');
const xlsx = require("xlsx");



const args =  {
  database:"mongodb://46.101.210.57:27017/alma",
  inputJson:"",
  output:"C:\Users\oussama.hassani\Documents\demo\extract-mongo-schema",
  collection:"offert,offertResponse,transaction"
} //commandLineArgs(optionDefinitions);


if (args.database && args.inputJson) {
  console.log('');
  console.log('Cannot provide both database connection string and input JSON path.');
  process.exit(1);
}

if (!args.database && !args.inputJson) {
  console.log('');
  console.log('Database connection string or input JSON path is missing.');;
  process.exit(1);
}

if (!args.output) {
  console.log('');
  console.log('Output path is missing.');
  process.exit(1);
}

if (fs.existsSync(args.output)) {
  const outputStat = fs.lstatSync(args.output);

  if (outputStat.isDirectory()) {
    console.log(`Error: output "${args.output}" is not a file.`);
    process.exit(1);
  }
}

let collectionList = null;
if (args.collection) {
  collectionList = args.collection.split(',');
}

let arrayList = null;
if (args.array) {
  arrayList = args.array.split(',');
}

const outputFormat = args.format || 'json';

const dontFollowTMP = args['dont-follow-fk'] || [];

const dontFollowFK = {
  __ANY__: {},
};

dontFollowTMP.map((df) => {
  const dfArray = df.split(':');

  let collection = '';
  let field = '';

  if (dfArray.length > 1) {
    collection = dfArray[0];
    field = dfArray[1];
  } else {
    collection = '__ANY__';
    field = dfArray[0];
  }
  dontFollowFK[collection][field] = true;
});

console.log('');
console.log('Extracting...');

const opts = {
  authSource: args.authSource,
  collectionList,
  arrayList,
  raw: args.raw,
  limit: args.limit,
  dontFollowFK,
  includeSystem: args['include-system'],
};


(async () => {
  try {
    let schema;
    if (args.inputJson) {
      // read input json
      const inputJsonPath = path.join(__dirname, args.inputJson)
      try {
        const inputJsonString = fs.readFileSync(inputJsonPath, 'utf8')
        schema = JSON.parse(inputJsonString)
      } catch (e) {
        console.log(`Error: cannot read input json file "${inputJsonPath}". ${e.message}`);
        process.exit(1);
      }
    }
    else {
      schema = await extractMongoSchema.extractMongoSchema(args.database, opts);
    }

    if (outputFormat === 'json') {
      try {
        fs.writeFileSync(args.output, JSON.stringify(schema, null, '\t'), 'utf8');
      } catch (e) {
        console.log(`Error: cannot write output "${args.output}". ${e.message}`);
        process.exit(1);
      }
    }

    if (outputFormat === 'html-diagram') {
      const templateFileName = path.join(__dirname, '/template-html-diagram.html');

      // read input file
      let templateHTML = '';
      try {
        templateHTML = fs.readFileSync(templateFileName, 'utf8');
      } catch (e) {
        console.log(`Error: cannot read template file "${templateFileName}". ${e.message}`);
        process.exit(1);
      }

      templateHTML = templateHTML.replace('{/*DATA_HERE*/}', JSON.stringify(schema, null, '\t'));

      try {
        fs.writeFileSync(args.output, templateHTML, 'utf8');
      } catch (e) {
        console.log(`Error: cannot write output "${args.output}". ${e.message}`);
        process.exit(1);
      }
    }
    if(outputFormat == "xlsx"){
      if(!args.output.endsWith(".xlsx")){
        console.log("Wrong output format [xlsx]");
        process.exit(1);
      }
      //get all collections
      var collections = Object.keys(schema);
      var wb = xlsx.utils.book_new();
      //one worksheet per collection
      collections.forEach(element => {
        var wsName = element;

        // console.log(element);
        var wsData = [["Collection", "primaryKey", "type", "structure", "require"]];
        var items = Object.keys(schema[element]);//items in collection        
        items.forEach( item => {                  
          var props = Object.keys(schema[element][item]);           
          var itemProperties = {          
            primaryKey: schema[element][item]["primaryKey"] != "undefined" ? schema[element][item]["primaryKey"] == "undefined" : false,
            type: schema[element][item]["type"] != "undefined" ? schema[element][item]["type"] : "undefined",
            structure: schema[element][item]["structure"] != "undefined" ? schema[element][item]["structure"] : "undefined",
            require: schema[element][item]["required"] != "undefined" ? schema[element][item]["required"] : "undefined"
          };           
          if(itemProperties.type != "undefined" && itemProperties.type == "Object"){
            itemProperties.structure = JSON.stringify(itemProperties.structure);
          }
          var data = [];
          data.push(item);
          data.push(itemProperties.primaryKey);
          data.push(itemProperties.type);
          data.push(itemProperties.structure);
          data.push(itemProperties.require);          
          wsData.push(data);        
        });
        // console.log(wsData);
        var ws = xlsx.utils.aoa_to_sheet(wsData);
        xlsx.utils.book_append_sheet(wb, ws, wsName);
      });
      xlsx.writeFile(wb, args.output);
    }

    console.log('Success.');
    console.log('');
  } catch (err) {
    console.log(err);
    process.exit(1);
  }
})();



