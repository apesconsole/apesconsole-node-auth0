// get an instance of mongoose and mongoose.Schema
var config			= require('./config'); // get our config file
var mongoose 		= require('mongoose');
var connection 		= mongoose.createConnection(config.cnstrntdatabase); 
var Schema 			= mongoose.Schema;

var orderSchema = mongoose.Schema({
		orderId: String,
		orderDate: Date,
		vendorName: String,
		vendorContact: String,
		vendorAddress: String,
		challan: String,
		invoice: String,
		quantity: Number,	
		orderStatus: String,
		approved: Boolean,
		updatedBy: String,
		updateDate: Date,
		approvedBy: String,
		approvalDate: Date		
	},{ _id : false });
	
var consumptionchema = mongoose.Schema({
		item: String,
		quantity: Number,
		uom: String,
		consumedBy: String,
		consumedDate: Date	
	},{ _id : false });
	
var inventorySchema = mongoose.Schema({
		item: String,
		quantity: Number,
		uom: String,
		orders: [
			orderSchema
		],
		consumption: [
			consumptionchema
		]	
	},{ _id : false });

// set up a mongoose model and pass it using module.exports
module.exports = connection.model('SITE_INVENTORY', new Schema({ 
	siteId: String,
	inventory: [
		inventorySchema
	],
	active: Boolean
}),'SITE_INVENTORY');