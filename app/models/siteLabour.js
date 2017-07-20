// get an instance of mongoose and mongoose.Schema
var config			= require('./config'); // get our config file
var mongoose 		= require('mongoose');
var connection 		= mongoose.createConnection(config.cnstrntdatabase); 
var Schema 			= mongoose.Schema;

var labourSchema = mongoose.Schema({
		labourId: String,
		contractor: Date,
		contractType: String,
		rate: Number,
		currency: String,
		count: Number,
		createDate: Date,
		createdBy: String,
		updatedBy: String,
		updateDate: Date,
		approvedBy: String,
		approvalDate: Date,
		approved: Boolean,
		active: Boolean
	},{ _id : false });

// set up a mongoose model and pass it using module.exports
module.exports = connection.model('SITE_LABOUR', new Schema({ 
	siteId: String,
	taskId: String,
	labour: [
		labourSchema
	]
}),'SITE_LABOUR');