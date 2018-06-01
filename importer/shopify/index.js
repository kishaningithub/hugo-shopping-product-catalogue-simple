'use strict';
const program = require('commander'),
      pkg = require('./package.json'),
      readline = require('readline'),
      request = require("request"),
      fs = require('fs'),
      _ = require('lodash');

function extractDataFromSite(siteUrl, outputDir){
  Promise.resolve(1).then(function fetchPage(pageNo) {
    extractProductsFromPage(siteUrl, pageNo).then(products => {
      writeProductsAsMarkdown(products, outputDir).catch(err => console.log(err));
      if(products.length > 0) {
        fetchPage(pageNo + 1);
      }
    }).catch(err => console.log(err));
  }).catch(err => console.log(err));
}

function getFileContent(product){
  return getFrontMatter(product) + "\n\n" + getContent(product);
}

function getFrontMatter(product) {
  let frontMatter = {}
  frontMatter.title = product.title;
  frontMatter.date = new Date().toISOString()
  frontMatter.tags = product.tags;
  if(program.categoryConversion && program.categoryConversion[product.product_type.toLowerCase()]) {
    frontMatter.categories = [program.categoryConversion[product.product_type.toLowerCase()]];
  } else {
    frontMatter.categories = [product.product_type];
  }
  frontMatter.images = product.images.map(image => image.src);
  frontMatter.thumbnailImage = product.images[0].src.replace('.jpg', '_large.jpg').replace('.png', '_large.png');
  if(product.options[0].name == "Title"){
    frontMatter.options = {}
  } else {
    frontMatter.options = product.options.reduce((map, option) => {
      map[option.name] = option.values;
      return map;
    }, {});
  }
  frontMatter.actualPrice = null;
  frontMatter.comparePrice = null;
  frontMatter.inStock = null;
  if(product.variants[0].title === "Default Title") {
    frontMatter.variants = [];
    frontMatter.actualPrice = product.variants[0].price;
    if(product.variants[0].compare_at_price && product.variants[0].compare_at_price > 0) {
      frontMatter.comparePrice = product.variants[0].compare_at_price;
    }
    frontMatter.inStock = product.variants[0].available;
  } else {
    frontMatter.variants = product.variants.map(variant => {
        let frontMatterVariant = {};
        frontMatterVariant.optionCombination = [variant.option1, variant.option2, variant.option3].filter(val => val != null);
        frontMatterVariant.actualPrice = variant.price;
        frontMatterVariant.comparePrice = variant.compare_at_price;
        frontMatterVariant.inStock = variant.available;
        return frontMatterVariant;
    });
  }
  return JSON.stringify(frontMatter, null, 4);
}

function getContent(product){
  return product.body_html;
}

function writeProductsAsMarkdown(products, outputDir){
  return new Promise(function (resolve, reject){
      products.forEach(product => {
        let outputFileName = product.title.replace(/\W/g, '-').replace(/-+/g, "-").toLowerCase();
        let outputFile = outputDir + "/" + outputFileName + ".md";
        if(product.images && product.images.length > 0) {
          fs.writeFile(outputFile, getFileContent(product), function(err) {
              if(err) {
                reject(err);
              }
          }); 
        }
    });
  });
}

function extractProductsFromPage(siteUrl, pageNo){
  let url = siteUrl + "products.json";
  let queryParams = {"page": pageNo};
  let headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36'
  };
  return new Promise(function(resolve, reject){
    request.get({url, headers, qs:queryParams}, (err, resp, body) => {
        if(err) {
            reject(err);
        }
        let products = JSON.parse(body).products;
        resolve(products);
    });
  });
  
}

function importProducts(outputDirectory) {
  let rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });
  
  rl.on('line', function (siteUrl) {
    extractDataFromSite(siteUrl, outputDirectory);
  });
}

function parseCategoryMap(val) {
  return _.transform(JSON.parse(val), function(result, value, key) {
    result[key.toLowerCase()] = value;
  }, {});
}

program
  .version(pkg.version)
  .description('Import products from shopify site')
  .usage('[options] <output directory>')
  .option("-c , --category-conversion [JSON]", "Custom map categories", parseCategoryMap)
  .action(importProducts)
  .parse(process.argv); 

if (program.args.length === 0) program.help();
