// get an instance of mongoose and mongoose.Schema
var config			= require('./config'); // get our config file
var mongoose 		= require('mongoose');
var connection 		= mongoose.createConnection(config.cnstrntdatabase); 
var Schema 			= mongoose.Schema;

var paymentSchema = mongoose.Schema({
		paymentId: String,
		payment: Number,
		paidBy: String,
		paymentDate: Date	
	},{ _id : false });

var orderSchema = mongoose.Schema({
		orderId: String,
		orderDate: Date,
		vendorName: String,
		vendorContact: String,
		vendorAddress: String,
		currency: String,
		unitPrice: Number,
		tax: Number,
		totalPrice: Number,
		totalPayment: Number,
		challan: String,
		invoice: String,
		quantity: Number,	
		estimatedDeliveryDays: Number,
		orderStatus: String,
		payments: [
			paymentSchema
		],
		approved: Boolean,
		createDate: Date,
		createdBy: String,
		updatedBy: String,
		updateDate: Date,
		approvedBy: String,
		approvalDate: Date		
	},{ _id : false });
	
var consumptionSchema = mongoose.Schema({
		item: String,
		quantity: Number,
		uom: String,
		consumedBy: String,
		consumedDate: Date
	},{ _id : false });

	
var globalRequestSchema = mongoose.Schema({
		requestId: String,
		requestStatus: String,
		transfer: Boolean,
		transferOrder: {
			transferOrderId: String,
			shippingVendor: String,
			estimatedDeliveryDays: Number,
			shippingId: String,
			shippingCost: Number,
			shippingType: String,
			trackingId: String,
			currency: String,
			payment: Number
		},
		requestedBy: String,
		requestDate: Date,
		rejected: Boolean,
		rejectedBy: String,
		rejectionDate: Date,
		approved: Boolean,
		approvedBy: String,
		approvalDate: Date		
	},{ _id : false });	
	
var inventorySchema = mongoose.Schema({
		item: String,
		quantity: Number,
		uom: String,
		totalPrice: Number,
		totalPayment: Number,		
		orders: [
			orderSchema
		],
		requests: [ 
			globalRequestSchema
		],
		consumption: [
			consumptionSchema
		],
		createDate: Date,
		createdBy: String,
		updatedBy: String,
		updateDate: Date,		
	},{ _id : false });

// set up a mongoose model and pass it using module.exports
module.exports = connection.model('SITE_INVENTORY', new Schema({ 
	siteId: String,
	taskId: String,
	inventory: [
		inventorySchema
	]
}),'SITE_INVENTORY');