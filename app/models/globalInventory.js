// get an instance of mongoose and mongoose.Schema
var config			= require('./config'); // get our config file
var mongoose 		= require('mongoose');
var connection 		= mongoose.createConnection(config.cnstrntdatabase); 
var Schema 			= mongoose.Schema;

var itemSchema = mongoose.Schema({
		item: String,
		quantity: Number,
		uom: String
	},{ _id : false });
	
var requestSchema = mongoose.Schema({
		requestId: String,
		siteId: String,
		taskId: String,
		
		item: String,
		quantity: Number,
		uom: String,
		requestedBy: String,
		requestDate: Date,
		rejected: Boolean,
		rejectedBy: String,
		rejectionDate: Date,
		approved: Boolean,
		approvedBy: String,
		approvalDate: Date
	},{ _id : false });	
// set up a mongoose model and pass it using module.exports
module.exports = connection.model('GLOBAL_INVENTORY', new Schema({ 
	configId: String,
	items: [
		itemSchema
	],
	requests: [
		requestSchema
	],	
	updatedBy: String,
	updateDate: Date
}),'GLOBAL_INVENTORY');