// get an instance of mongoose and mongoose.Schema
var config			= require('./config'); // get our config file
var mongoose 		= require('mongoose');
var connection 		= mongoose.createConnection(config.cnstrntdatabase); 
var Schema 			= mongoose.Schema;

var itemSchema = mongoose.Schema({
		item: String,
		dimension: String,
		uom: String,
		canDelete: Boolean
	},{ _id : false });
// set up a mongoose model and pass it using module.exports
module.exports = connection.model('SITE_INVENTORY_CONFIG', new Schema({ 
	configId: String,
	items: [
		itemSchema
	],
	updatedBy: String,
	updateDate: Date
}),'SITE_INVENTORY_CONFIG');