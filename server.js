/*
	Apes's Console
*/

const Express  		= require("express");
const bodyParser 	= require('body-parser');
var morgan      	= require('morgan');
var mongoose    	= require('mongoose');
var url 			= require("url");
var app = Express();
var http = require('http').Server(app);
var router = Express.Router();

var logger = require("logging_component");
var jwt    = require('jsonwebtoken'); // used to create, sign, and verify tokens
var config = require('./config'); // get our config file
var user   = require('./app/models/user'); // get our mongoose model
var menu   = require('./app/models/menu');

var cnstrntSiteUserMap
		   = require('./app/models/cnstrntSiteUserMap');      
var globalInventory
		   = require('./app/models/globalInventory');
var inventoryConfig
		   = require('./app/models/inventoryConfig');
var cnstrntSite
		   = require('./app/models/cnstrntSite');		   
var siteInventory		  
		   = require('./app/models/siteInventory');	  
var siteLabour		  
		   = require('./app/models/siteLabour');			   
		   
app.set('superSecret', config.secret); 

// use body parser so we can get info from POST and/or URL parameters
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
var port = process.env.PORT || 3003;
// use morgan to log requests to the console
app.use(morgan('dev'));
// Add headers
app.use(function (req, res, next) {
    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', '*');
    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,x-www-form-urlencoded, Accept');
    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);
    // Pass to next layer of middleware
    next();
});

router.post('/authenticate', function(req, res) {
  // find the user
  user.findOne({
    userId: req.body.userId
  }, function(err, userData) {
    if (err) throw err;
    if (!userData) {
      res.json({ success: false, message: 'User not found' });
    } else if (userData) {
      // check if password matches
      if (userData.password != req.body.password) {
        res.json({ success: false, message: 'Wrong password' });
      } else if(!userData.active){
		res.json({ success: false, message: 'User is Inactive. Contact Admin.' });
	  } else {
        // if user is found and password is right
        // create a token
        var token = jwt.sign(userData, app.get('superSecret'), {
          expiresIn : 60*30 // expires in 1 minute
        });
        // return the information including token as JSON
        res.json({
          success: true,
          message: 'Token Generated',
          token: token
        });
      }   
    }
  });
});  

router.use(function(req, res, next) {
  // check header or url parameters or post parameters for token
  var tokenString = req.body.token || req.query.token || req.headers['x-access-token'];
  // decode token
  if (null != tokenString &&  tokenString.split(' ')[0] == 'Bearer') {
    var token = tokenString.split(' ')[1]
    // verifies secret and checks exp
    jwt.verify(token, app.get('superSecret'), function(err, decoded) {      
      if (err) {
        return res.json({ success: false, message: 'Invalid/Expired Token. Please Login Again' });    
      } else {
        // if everything is good, save to request for use in other routes
        req.decoded = decoded;    
        next();
      }
    });

  } else {

    // if there is no token
    // return an error
    return res.status(403).send({ 
        success: false, 
        message: 'No token provided.' 
    });

  }
});

router.get('/', function(req, res) {
  res.json({ message: 'Welcome to SmartCom! Please Authenticate to Get Access Token.' });
});

router.get('/user', function(req, res) {
  var userId = req.body.userId || req.query.userId;
  console.log('looking for ->' + userId)
  user.findOne({'userId': userId}, function(err, userData) {
	userData.password = null;
	menu.find({'userId': userId }, function(err, menuList) {
		res.json({success: true, data: userData, menu: menuList});
	});
  });
});

router.get('/loadconstructionsitematrix', function(req, res) {
  var userId = req.body.userId || req.query.userId;	
  cnstrntSiteUserMap.find({'userId': userId}).exec(function(err, validSites) {
	  var sites = [];
	  validSites.forEach(function(site) {
		  sites[sites.length] = site.siteId;
	  });
	  if(validSites.length > 0)
		  cnstrntSite.find({ 'siteId': { $in: sites }, 'active': true}).sort({siteId: 1}).exec(function(err, siteData) {
			  var siteMatrix = [];
			  for(var i = 0; i<siteData.length; i++){
					var canViewFinance = false;
					for(var j = 0; j<validSites.length; j++){
						if(siteData[i].siteId == validSites[j].siteId){
							canViewFinance = validSites[j].viewFinance;
							break;
						}
					}
					var st = {
						projectId: '',
						siteId:'',
						siteName:'',
						address: '',
						canViewFinance: canViewFinance,
						taskMatrix: {
							currency: 'INR',
							totalCompletedTasks: 0,
							totalWaitingTasks: 0,
							totalHeldTasks: 0,
							totalRunningTasks: 0,
							totalCost: 0,
							totalPayment: 0,
							totalEstimatedCost: 0,
							deviation: 0,
							savings: 0
						}
					};
					if(siteData[i].taskList.length > 0){
						st.projectId 	= siteData[i].projectId;
						st.siteId 		= siteData[i].siteId;
						st.siteName 	= siteData[i].siteName;
						st.address 		= siteData[i].address;
						for(var j = 0; j<siteData[i].taskList.length; j++){
							var tsk = siteData[i].taskList[j];
							if(tsk.taskStatus == 'Complete'){
								st.taskMatrix.totalCompletedTasks = eval(st.taskMatrix.totalCompletedTasks + 1); 
							}
							if(tsk.taskStatus == 'Waiting'){
								st.taskMatrix.totalWaitingTasks = eval(st.taskMatrix.totalWaitingTasks + 1); 
							}
							if(tsk.taskStatus == 'Hold'){
								st.taskMatrix.totalHeldTasks = eval(st.taskMatrix.totalHeldTasks + 1); 
							}
							if(tsk.taskStatus == 'Started'){
								st.taskMatrix.totalRunningTasks = eval(st.taskMatrix.totalRunningTasks + 1); 
							}
							st.taskMatrix.totalCost = eval(st.taskMatrix.totalCost) + eval(tsk.actualCost);
							st.taskMatrix.totalEstimatedCost = eval(st.taskMatrix.totalEstimatedCost) + eval(tsk.estimatedCost);
							st.taskMatrix.totalPayment = eval(st.taskMatrix.totalPayment) + eval(tsk.totalPayment);							
						}
						if(st.taskMatrix.totalEstimatedCost > st.taskMatrix.totalCost){
							st.taskMatrix.savings = eval(st.taskMatrix.totalEstimatedCost) - eval(st.taskMatrix.totalCost);
						}
						if(st.taskMatrix.totalCost > st.taskMatrix.totalEstimatedCost){
							st.taskMatrix.deviation = eval(st.taskMatrix.totalCost) - eval(st.taskMatrix.totalEstimatedCost);
						}				
						siteMatrix[siteMatrix.length] = st;	
					}			
			  }
			  res.json({success: true, data: siteMatrix});
		  });
	  else res.json({success: true, data: []});
  });
});

//Set Up Task And Inventory
router.post('/createtask', function(req, res) {
	var userId = req.body.userId || req.query.userId;
	var siteData = req.body.siteData || req.query.siteData;
	var taskInventory = req.body.taskInventory || req.query.taskInventory;
	var taskLabour = req.body.taskLabour || req.query.taskLabour;
    var siteDataJson = JSON.parse(siteData); 
	var taskInventoryJson = JSON.parse(taskInventory); 
	var taskLabourJson = JSON.parse(taskLabour); 
	var newInventory = new siteInventory(taskInventoryJson);
	var newLabour = new siteLabour(taskLabourJson);
	
	cnstrntSite.update({siteId: siteDataJson.siteId}, {
			taskList: siteDataJson.taskList
		},function(err) {
		if (err) {
			res.json({ success: true, operation: false });
		} else {
			logger.log('Site Updated successfully');
			newInventory.save(function(err) {
				if (err) {
					res.json({ success: true, operation: false });
				} else {	
					newLabour.save(function(err) {
						if (err) {
							res.json({ success: true, operation: false });
						} else {
							logger.log('Task saved successfully');
							res.json({ success: true , operation: true});
						}
					});	
				}
			});			
		}
	});	
});	
	
router.post('/edittask', function(req, res) {
	var userId = req.body.userId || req.query.userId;
	var siteData = req.body.siteData || req.query.siteData;
	var taskDetails = req.body.taskDetails || req.query.taskDetails;
    var siteDataJson = JSON.parse(siteData); 
	var taskDetailsJson = JSON.parse(taskDetails);
	
	cnstrntSite.update({siteId: siteDataJson.siteId}, {
			taskList: siteDataJson.taskList
		},function(err) {
		if (err) {
			res.json({ success: true, operation: false });
		} else {
			logger.log('Site Updated successfully');
			if(taskDetailsJson.taskStatus == 'Complete'){
				siteInventory.findOne({'siteId': siteDataJson.siteId, taskId: taskDetailsJson.taskId}).exec(function(err, inventoryData) {
					if(!err){
						var inventory = inventoryData.inventory;
						globalInventory.findOne({configId: "ITEM"},function(err, globalData) {
							if(!err){
								var items = [];
								for(var i = 0; i<inventory.length; i++){
									var found = false;
									for(var j = 0; j<globalData.items.length; j++){
										if(inventory[i].item == globalData.items[j].item){
											 found = true;
											 logger.log('Found - Adding Qauntity - ' + globalData.items[j]);
											 globalData.items[j].quantity = eval(globalData.items[j]) + eval(inventory[i].quantity);
											 items[items.length] = {
												item: globalData.items[j].item,
												uom: globalData.items[j].uom,
												quantity: globalData.items[j].quantity
											 };
											 break;
										}
									}
									if(!found){
										logger.log('Not Found Adding new - ' + inventory[i]);
										items[items.length] = {
											item: inventory[i].item,
											uom: inventory[i].uom,
											quantity: inventory[i].quantity
										};
									}
									inventory[i].quantity = 0;
									//Reject All Pending Requests for Items in Task Inventory
									for(var j = 0; j<globalData.requests.length; j++){
										if(inventory[i].item == globalData.requests[j].item && taskDetailsJson.taskId == globalData.requests[j].taskId){
											if(!globalData.requests[j].approved && !globalData.requests[j].rejected){
												globalData.requests[j].rejected = true;
												globalData.requests[j].rejectedBy = 'System';
												globalData.requests[j].rejectionDate = new Date();
											}
										}
									}
								}
								logger.log('items List - ' + items.length);
								//Update Config Data
								globalInventory.update({configId: 'ITEM'}, {
										items: items,
										requests: globalData.requests,
										updatedBy: userId,
										updateDate: new Date()
									},function(err) {
									if (err) {
										res.json({ success: true, operation: false });
									} else {
										logger.log('Global Data Updated Successfully');
										siteInventory.update({'siteId': siteDataJson.siteId, taskId: taskDetailsJson.taskId}, {
												inventory: inventory, 
											},function(err) {
											if (err) {
												res.json({ success: true, operation: false });
											} else {
												logger.log('Site Data Updated Successfully');
												res.json({ success: true, operation: true });
											}
										});
									}
								});	
							}
						});
					}
					else res.json({ success: true , operation: false});
				});
			}
			else {
				res.json({ success: true , operation: true});	
			}				
		}
	});	
});	
	
//Inventory Set Up
router.get('/loadglobaliteminventoryconfig', function(req, res) {
  globalInventory.findOne({configId: "ITEM"},function(err, configData) {
	res.json({success: true, data: configData});
  });
});

router.post('/saveglobalinventoryrequests', function(req, res) {
	var userId = req.body.userId || req.query.userId;
	var configData = req.body.configData || req.query.configData;
    var configDataJson = JSON.parse(configData); 
	//Update Config Data
	globalInventory.update({configId: 'ITEM'}, {
			requests: configDataJson.requests,
			updatedBy: userId,
			updateDate: new Date()
		},function(err) {
		if (err) {
			res.json({ success: true, operation: false });
		} else {
			logger.log('Global Config Updated successfully');
			res.json({ success: true , operation: true});
		}
	});
});

router.post('/approveglobalinventoryrequest', function(req, res) {
	var userId = req.body.userId || req.query.userId;
	var siteData = req.body.siteData || req.query.siteData;
	var requestId = req.body.requestId || req.query.requestId;
	var selectedItem = req.body.selectedItem || req.query.selectedItem;
    var siteDataJson = JSON.parse(siteData);
	
	//Update Config Data
	globalInventory.findOne({configId: "ITEM"},function(err, globalData) {
		if(!err){
			console.log(1);
			var found = false;
			var availableQuantity = 0;
			for(var i = 0; i<globalData.items.length; i++ ){
				if(globalData.items[i].item == selectedItem){
					found = true;
					availableQuantity = globalData.items[i].quantity;
					break;
				}
			}
			console.log(2);
			if(found){
				console.log(3);
				var response = {};
				for(var i = 0; i<globalData.requests.length; i++ ){
					if(globalData.requests[i].requestId == requestId && globalData.requests[i].siteId == siteDataJson.siteId && globalData.requests[i].taskId == siteDataJson.taskId){
					   if(!globalData.requests[i].rejected && !globalData.requests[i].approved && availableQuantity < globalData.requests[i].quantity){
							globalData.requests[i].rejected = true;
							globalData.requests[i].rejectedBy = 'System';
							globalData.requests[i].rejectionDate = new Date();
							response['status'] = 'Request Rejected! Not Enough Quntity';
					   } else if(!globalData.requests[i].rejected && !globalData.requests[i].approved && availableQuantity >= globalData.requests[i].quantity){
							globalData.requests[i].approved = true;
							globalData.requests[i].approvedBy = userId;
							globalData.requests[i].approvalDate = new Date();
							response['status'] = 'Request Approved!';
							
							//Global Inventory Reduced
							for(var j = 0; j<globalData.items.length; j++ ){
								if(globalData.items[j].item == selectedItem){
									console.log('globalData.items[j].quantity = ' + globalData.items[j].quantity);
									globalData.items[j].quantity = eval(globalData.items[j].quantity) - eval(globalData.requests[i].quantity);
									console.log('After Update quantity = ' + globalData.items[j].quantity);
									break;
								}
							}
							
							//Task Inventory Increased
							for(var j = 0; j<siteDataJson.inventory.length; j++ ){
								if(siteDataJson.inventory[j].item = selectedItem){
									console.log('siteDataJson.inventory[j].quantity = ' + siteDataJson.inventory[j].quantity);
									siteDataJson.inventory[j].quantity = eval(siteDataJson.inventory[j].quantity) + eval(globalData.requests[i].quantity);
									console.log('After Update quantity = ' + siteDataJson.inventory[j].quantity);
									break;
								}
							}
					   }
					   console.log(response['status']);
					   break;
					}
				}
			}
			globalInventory.update({configId: 'ITEM'}, {
					items: globalData.items,
					requests: globalData.requests,
					updatedBy: userId,
					updateDate: new Date()
				},function(err) {
				if (err) {
					res.json({ success: true, operation: false});
				} else {
					logger.log('Config Updated successfully');
					siteInventory.update({siteId: siteDataJson.siteId, taskId: siteDataJson.taskId}, {
							inventory: siteDataJson.inventory
						},function(err) {
							if(!err){
								logger.log('Site Data Updated successfully');
								res.json({ success: true , operation: true, response: response});
							} else res.json({ success: true, operation: false });
						});
				}
			});
		} else res.json({ success: true, operation: false });
	});
});

router.get('/loaditeminventoryconfig', function(req, res) {
  inventoryConfig.findOne({configId: "ITEM"},function(err, configData) {
	  if(!err){
		res.json({success: true, data: configData});
	  } else res.json({success: true, data: []});
  });
});

router.post('/saveinventoryconfig', function(req, res) {
	var userId = req.body.userId || req.query.userId;
	var configData = req.body.configData || req.query.configData;
    var configDataJson = JSON.parse(configData); 
	
	//Update Config Data
	inventoryConfig.update({configId: configDataJson.configId}, {
			items: configDataJson.items, 
			updatedBy: userId,
			updateDate: new Date()
		},function(err) {
		if (err) {
			res.json({ success: true, operation: false });
		} else {
			logger.log('Config Updated successfully');
			res.json({ success: true , operation: true});
		}
	});
});

router.get('/loadcnstrntsites', function(req, res) {
  var userId = req.body.userId || req.query.userId;	
  cnstrntSiteUserMap.find({'userId': userId}).exec(function(err, validSites) {
		 console.log("validSites - >" + validSites.length)
	  var sites = [];
	  validSites.forEach(function(site) {
		  sites[sites.length] = site.siteId;
	  });
	  if(validSites.length > 0)
		  cnstrntSite.find({ 'siteId': { $in: sites }, 'active': true}).sort({siteId: 1}).exec(function(err, siteData) {
			  res.json({success: true, data: siteData, permission: validSites});
		  });
	  else res.json({success: true, data: []});
  });
});

router.get('/loadsiteinventory', function(req, res) {
  var userId = req.body.userId || req.query.userId;	
  var siteId = req.body.siteId || req.query.siteId;	
  var taskId = req.body.taskId || req.query.taskId;
  siteInventory.findOne({ 'siteId': siteId, 'taskId': taskId }).exec(function(err, inventoryData) {
	  if(!err){
		res.json({success: true, data: inventoryData});
	  }
	  else res.json({success: true, data: []});
  });
});

router.post('/savesiteinventory', function(req, res) {
	var userId = req.body.userId || req.query.userId;
	var siteData = req.body.siteData || req.query.siteData;
    var siteDataJson = JSON.parse(siteData); 
	console.log('Save step 1');
	for(var i=0; i<siteDataJson.inventory.length; i++ ){
		var totalInventoryPayment = 0;
		var totalInventoryPrice = 0;
		var orders = siteDataJson.inventory[i].orders;
		for(var j=0; j<orders.length; j++ ){
			var order = orders[j];
			if(order.approved){
				var totalOrderPayment = 0;
				for(var k=0; k<order.payments.length; k++ ){
					var payment = order.payments[k];
					totalOrderPayment = eval(totalOrderPayment) + eval(payment.payment);
				}
				siteDataJson.inventory[i].orders[j].totalPayment = eval(totalOrderPayment);
				totalInventoryPrice = eval(totalInventoryPrice) + eval(order.totalPrice);
				totalInventoryPayment = eval(totalInventoryPayment) + eval(totalOrderPayment);				
			}
		}
		siteDataJson.inventory[i].totalPayment = totalInventoryPayment;
		siteDataJson.inventory[i].totalPrice = totalInventoryPrice;		
	}	
	console.log('Save step 1 - Complete');
	//Update Inventory Data
	siteInventory.update({siteId: siteDataJson.siteId, taskId: siteDataJson.taskId}, {
			inventory: siteDataJson.inventory
		},function(err) {
		if (err) {
			res.json({ success: true, operation: false });
		} else {
			logger.log('Inventory Updated successfully');
			cnstrntSite.findOne({siteId: siteDataJson.siteId}).exec(function(err, data) {
				  var totalCost = 0;
				  var totalPayment = 0;
				  for(var i=0; i<siteDataJson.inventory.length; i++ ){
					  var item = siteDataJson.inventory[i];
					  totalCost = eval(totalCost) + eval(item.totalPrice);
					  totalPayment = eval(totalPayment + item.totalPayment);
					  console.log('Inventory Cost: siteDataJson.inventory - i =' + 0 + ', cost=' +  totalCost);
					  console.log('Inventory totalPayment: siteDataJson.inventory - i =' + 0 + ', cost=' +  totalPayment);
				  }	
				  console.log('Inventory Cost: ' +  totalCost);
				  siteLabour.findOne({siteId: siteDataJson.siteId, taskId: siteDataJson.taskId}).exec(function(err, labourData) {
					  for(var i=0; i<labourData.labour.length; i++ ){
						  var labour = labourData.labour[i];
						  totalCost = eval(totalCost) + eval(labour.totalBill);
						  totalPayment = eval(totalPayment + labour.totalPayment);
						  console.log('labour totalPayment: labourData.labour - i =' + 0 + ', cost=' +  totalPayment);
					  }	
					  console.log('Labour Cost: ' +  totalCost);
					  console.log('Labour Pay: ' +  totalPayment);
					  for(var i=0; i<data.taskList.length; i++ ){
						  if(data.taskList[i].taskId == siteDataJson.taskId){
							data.taskList[i].actualCost = totalCost;
							data.taskList[i].totalPayment = totalPayment;
							break;
						  }
					  }	
					  console.log('Task Cost: ' +  totalCost);
					  cnstrntSite.update({siteId: siteDataJson.siteId}, {
							taskList: data.taskList
						},function(err) {
							if (err) {
								res.json({ success: true, operation: false });
							} else {
								logger.log('Task Cost Updated successfully');
								inventoryConfig.findOne({configId: "ITEM"},function(err, configData) {
									if(!err){
										var lockItem = false;
										for(var i=0; i<siteDataJson.inventory.length; i++ ){
											for(var j=0; j<configData.items.length; j++ ){
												console.log('configData.items[j].canDelete = ' + configData.items[j].canDelete);
												if(configData.items[j].canDelete && siteDataJson.inventory[i].item == configData.items[j].item){
													configData.items[j].canDelete = false;
													lockItem = true;
													break;
												}
											}
											if(lockItem) break;
										}
										if(lockItem){
											inventoryConfig.update({configId: 'ITEM'}, {
													items: configData.items, 
													updatedBy: 'System',
													updateDate: new Date()
												},function(err) {
												if (err) {
													res.json({ success: true, operation: false });
												} else {
													logger.log('Config Locked successfully');
													res.json({ success: true , operation: true});
												}
											});
										} else {
											res.json({ success: true , operation: true});
										}											
									} else res.json({success: true, data: []});
								});								
							}
					  });	
				  });
		    });
		}
	});
});

router.get('/loadsitelabour', function(req, res) {
  var userId = req.body.userId || req.query.userId;	
  var siteId = req.body.siteId || req.query.siteId;	
  var taskId = req.body.taskId || req.query.taskId;
  siteLabour.findOne({ 'siteId': siteId, 'taskId': taskId }).exec(function(err, labourData) {
	  if(!err){
		res.json({success: true, data: labourData});
	  }
	  else res.json({success: true, data: []});
  });
});

router.post('/savesitelabour', function(req, res) {
	var userId = req.body.userId || req.query.userId;
	var siteData = req.body.siteData || req.query.siteData;
    var siteDataJson = JSON.parse(siteData); 
	console.log('Save step 1');
	for(var i=0; i<siteDataJson.labour.length; i++ ){
		var totalLabourPayment = 0;
		var totalLabourBill = 0;
		var bills = siteDataJson.labour[i].billing;
		for(var j=0; j<bills.length; j++ ){
			var bill = bills[j];
			if(bill.approved){
				var totalBillPayment = 0;
				for(var k=0; k<bill.payments.length; k++ ){
					var payment = bill.payments[k];
					totalBillPayment = eval(totalBillPayment) + eval(payment.payment);
				}
				siteDataJson.labour[i].billing[j].totalPayment = totalBillPayment;
				totalLabourBill = eval(totalLabourBill) + eval(bill.billingAmount);
				totalLabourPayment = eval(totalLabourPayment) + eval(totalBillPayment);
			}
		}
		siteDataJson.labour[i].totalPayment = totalLabourPayment;
		siteDataJson.labour[i].totalBill = totalLabourBill;
	}	
	console.log('Save step 1 - Complete');
	//Update labour Data
	siteLabour.update({siteId: siteDataJson.siteId, taskId: siteDataJson.taskId}, {
			labour: siteDataJson.labour
		},function(err) {
		if (err) {
			res.json({ success: true, operation: false });
		} else {
			logger.log('Labour Updated successfully');
			cnstrntSite.findOne({siteId: siteDataJson.siteId}).exec(function(err, data) {
				  var totalCost = 0;
				  var totalPayment = 0;
				  for(var i=0; i<siteDataJson.labour.length; i++ ){
					  var labour = siteDataJson.labour[i];
					  totalCost = eval(totalCost + labour.totalBill);
					  totalPayment = eval(totalPayment + labour.totalPayment);
				  }		
					console.log(1);					  
				  siteInventory.findOne({siteId: siteDataJson.siteId, taskId: siteDataJson.taskId}).exec(function(err, inventoryData) {
					  for(var i=0; i<inventoryData.inventory.length; i++ ){
						  var item = inventoryData.inventory[i];
						  totalCost = eval(totalCost + item.totalPrice);
						  totalPayment = eval(totalPayment + item.totalPayment);
					  }
					  console.log(2);	
					  for(var i=0; i<data.taskList.length; i++ ){
						  if(data.taskList[i].taskId == siteDataJson.taskId){
							data.taskList[i].actualCost = totalCost;
							data.taskList[i].totalPayment = totalPayment;
							break;
						  }
					  }	
					  console.log('Total : ' + totalCost);						  
					  cnstrntSite.update({siteId: siteDataJson.siteId}, {
							taskList: data.taskList
						},function(err) {
							if (err) {
								res.json({ success: true, operation: false });
							} else {
								logger.log('Task Cost Updated successfully');
								res.json({ success: true , operation: true});			
							}
					  });	
				  });
		    });
		}
	});
});

app.use('/api', router);

app.get('/', function(req, res) {
    res.send('Hello! The API is at http://localhost:' + port + '/api');
});

http.listen(port, () => {				
	logger.log('##################################################');
	logger.log('        Ape\'s Console - NODE - JWT ');
	logger.log('        Process Port :' + process.env.PORT);
	logger.log('        Local Port   :' + port);
	logger.log('##################################################');
});	



