// get an instance of mongoose and mongoose.Schema
var config			= require('./config'); // get our config file
var mongoose 		= require('mongoose');
var connection 		= mongoose.createConnection(config.cnstrntdatabase); 
var Schema 			= mongoose.Schema;

// set up a mongoose model and pass it using module.exports
module.exports = connection.model('SITE_USER_MAP', new Schema({ 
	userId: String,
	siteId: String,
    edit: Boolean,
	viewFinance: Boolean,
	export: Boolean,
	approve: Boolean,
    createOrder: Boolean,
    createBill: Boolean,	
	pay: Boolean,
	notification: {
		active: Boolean,
        task_add_info: Boolean,
        task_edit_info: Boolean,
        task_inventory_approval_info: Boolean,
        task_inventory_edit_info: Boolean,
        task_inventory_order_approval_info: Boolean,
        task_inventory_order_complete_info: Boolean,
        task_inventory_order_payment_info: Boolean,
        task_labour_approval_request: Boolean,
        task_labour_approval_info: Boolean,
        task_labour_edit_info: Boolean,
        task_labour_bill_create_info: Boolean,
        task_labour_bill_approval_request: Boolean,
        task_labour_bill_approval_info: Boolean,
        task_labour_bill_payment_info: Boolean
	}
}),'SITE_USER_MAP');