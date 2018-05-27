'use strict';
const program = require('commander'),
      pkg = require('./package.json'),
      readline = require('readline'),
      request = require("request"),
      fs = require('fs');

function extractDataFromSite(siteUrl, outputDir){
  Promise.resolve(1).then(function fetchPage(pageNo) {
    extractProductsFromPage(siteUrl, pageNo).then(products => {
      writeProductsAsMarkdown(products, outputDir);
      if(products.length > 0) {
        fetchPage(pageNo + 1);
      }
    });
  });
}

function getFileContent(product){
  return getFrontMatter(product) + "\n\n" + getContent(product);
}

function getFrontMatter(product) {
  let frontMatter = {}
  frontMatter.title = product.title;
  frontMatter.date = new Date().toISOString()
  frontMatter.tags = product.tags;
  frontMatter.categories = product.product_type;
  frontMatter.images = product.images.map(image => image.src);
  frontMatter.thumbnailImage = product.images[0].src;
  if(product.options[0].name == "Title"){
    frontMatter.options = {}
  } else {
    frontMatter.options = product.options.map(option => {
        let frontMatterOption = {};
        frontMatterOption[option.name] = option.values;
        return frontMatterOption;
    });
  }
  if(product.variants[0].title === "Default Title") {
    frontMatter.variants = [];
    frontMatter.actualPrice = product.variants[0].price;
    frontMatter.comparePrice = product.variants[0].compare_at_price;
    frontMatter.inStock = product.variants[0].available;
  } else {
    frontMatter.actualPrice = null;
    frontMatter.comparePrice = null;
    frontMatter.inStock = null;
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
        let outputFile = outputDir + "/" + product.handle + ".md";
        fs.writeFile(outputFile, getFileContent(product), function(err) {
          if(err) {
              console.dir(err);
          }
      }); 
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

program
  .version(pkg.version)
  .description('Import products from shopify site')
  .arguments('[output-directory]')
  .action(importProducts)
  .parse(process.argv); 

if (program.args.length === 0) program.help();