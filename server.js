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

var emailHelper = require('sendgrid').mail;

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

var emailService = function(emailContainer, callBack){
	var sg = require('sendgrid')(config.email_api_key);
	var request = sg.emptyRequest({
	  method: 'POST',
	  path: '/v3/mail/send',
	  body: {
		personalizations: [
		  {
			to: emailContainer.toIdList,
			subject: emailContainer.subject
		  }
		],
		from: {
		  email: 'smartcomAdministration@smartcom.com'
		},
		content: [
		  {
			type: 'text/plain',
			value: emailContainer.content
		  }
		]
	 }
	});	
	sg.API(request, function (error, response) {
		  console.log(response.statusCode);
		  console.log(response.body);
		  console.log(response.headers);		
		  if (error) {
			  callBack.failure();
		  } else {
			callBack.success(response);
		  }
	});	
}

var emailHandler = function(emailContainer, callBack){
  cnstrntSiteUserMap.find({'siteId': emailContainer.siteId}).exec(function(err, validUsers) {
		for(var i = 0; i<validUsers.length; i++){
			if(validUsers[i].notification.active && validUsers[i].notification[emailContainer.notificationKey]){
				if(emailContainer.targeted){
					//Targeted Emails
					if(validUsers[i].userId == emailContainer.targetedTo){
						emailContainer.toIdList[emailContainer.toIdList.length] = validUsers[i].userId;
						break;
					}
				} else{
					//Assigned Emails
					emailContainer.toIdList[emailContainer.toIdList.length] = validUsers[i].userId;
				}
			}
		}
		if(emailContainer.toIdList.length > 0){
			user.find({'userId': { $in: emailContainer.toIdList }}, ['emailId']).exec(function(err, validEmailId) {
				//UserId - > EmailId Transformation
				emailContainer.toIdList = [];
				for(var i = 0; i<validEmailId.length; i++){
					console.log(validUsers[i].notification[emailContainer.notificationKey])
					if(validUsers[i].notification.active && validUsers[i].notification[emailContainer.notificationKey]){
						emailContainer.toIdList[emailContainer.toIdList.length] = {
							email: validEmailId[i].emailId,
						  };
					}
				}
				if(emailContainer.toIdList.length > 0){
					emailService(emailContainer, {
						success: function(r){
							callBack.success(r);
						}, failure: function(){
							callBack.failure();
						}
					});
				} else callBack.failure();
			});
		} else callBack.failure();
  });
}

router.get('/', function(req, res) {
  res.json({ message: 'Welcome to SmartCom! Please Authenticate to Get Access Token.' });
});

router.get('/user', function(req, res) {
  var userId = req.body.userId || req.query.userId;
  user.findOne({'userId': userId}, function(err, userData) {
	userData.password = null;
	menu.find({'userId': userId }, function(err, menuList) {
		res.json({success: true, data: userData, menu: menuList});
	});
  });
});

//Inventory Set Up
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

//Load Site Matrix Data
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
							actualInventoryCost: 0,
							totalInventoryPayment: 0,
							actualLabourCost: 0,
							totalLabourPayment: 0,
							totalLabour: 0,
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
							if(tsk.taskStatus == 'Running'){
								st.taskMatrix.totalRunningTasks = eval(st.taskMatrix.totalRunningTasks + 1); 
							}
							//Total Cost 
							st.taskMatrix.actualInventoryCost = eval(st.taskMatrix.actualInventoryCost) + eval(tsk.actualInventoryCost);
							st.taskMatrix.actualLabourCost = eval(st.taskMatrix.actualLabourCost) + eval(tsk.actualLabourCost);
							
							//Total Payment
							st.taskMatrix.totalInventoryPayment = eval(st.taskMatrix.totalInventoryPayment) + eval(tsk.totalInventoryPayment);	
							st.taskMatrix.totalLabourPayment = eval(st.taskMatrix.totalLabourPayment) + eval(tsk.totalLabourPayment);	
							
							//Total Estimation
							st.taskMatrix.totalEstimatedCost = eval(st.taskMatrix.totalEstimatedCost) + eval(tsk.estimatedCost);	
							
							st.taskMatrix.totalLabour = eval(st.taskMatrix.totalLabour) + eval(tsk.totalLabour);
						}
						st.taskMatrix.totalCost = eval(st.taskMatrix.actualInventoryCost) + eval(st.taskMatrix.actualLabourCost);
						st.taskMatrix.totalPayment = eval(st.taskMatrix.totalInventoryPayment) + eval(st.taskMatrix.totalLabourPayment);
						
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

//Create Task
router.post('/createtask', function(req, res) {
	var userId = req.body.userId || req.query.userId;
	var siteId = req.body.siteId || req.query.siteId;
	var taskDetails = req.body.taskDetails || req.query.taskDetails;
	var notificationData = req.body.notificationData || req.query.notificationData;
	
    var newTaskJson = JSON.parse(taskDetails); 
	newTaskJson.createdBy = userId;
	newTaskJson.createDate  = new Date();
	
	var newInventory = new siteInventory({
		siteId: siteId,
		taskId: newTaskJson.taskId,
		inventory: []
	});
	var newLabour = new siteLabour({
		siteId: siteId,
		taskId: newTaskJson.taskId,
		labour: []
	});
	
	var notificationDataJson = JSON.parse(notificationData);

	cnstrntSite.findOne({siteId: siteId}, function(err, siteData){
		siteData.taskList.push(newTaskJson);
		siteData.save(function(err, obj){
		if (err) {
			res.json({ success: true, operation: false });
		} else {
			logger.log('Site Updated successfully');
			newInventory.save(function(err, obj) {
					if (err) {
						res.json({ success: true, operation: false });
					} else {	
						newLabour.save(function(err) {
							if (err) {
								res.json({ success: true, operation: false });
							} else {
								logger.log('Task saved successfully');
								emailHandler({
								//Container
									targeted: false,
									targetedTo: '',
									siteId: siteId,
									notificationKey: notificationDataJson.key,
									subject: notificationDataJson.subject,
									content: notificationDataJson.message,
									toIdList: []
								},{
									//Call Back
									success: function(r){
										logger.log('Email Sent Successfully');
										res.json({ success: true, operation: true});
									}, failure: function(){
										logger.log('Email Not Sent. But it is still a Successfull Data Entry');
										res.json({ success: true , operation: true});
									}
								});
							}
						});	
					}
			   });			
		     }
		});
	});
});	

//Update Task
router.post('/updatetask', function(req, res) {
	var userId = req.body.userId || req.query.userId;
	var siteId = req.body.siteId || req.query.siteId;
	var taskDetails = req.body.taskDetails || req.query.taskDetails;
	var notificationData = req.body.notificationData || req.query.notificationData;
	
    var taskDetailsJson = JSON.parse(taskDetails); 
	
	var notificationDataJson = JSON.parse(notificationData);

	cnstrntSite.findOne({siteId: siteId}, function(err, siteData){
		siteData.taskList.forEach(function(task){
			if(task.taskId == taskDetailsJson.taskId){
				task.taskDescription  = taskDetailsJson.taskDescription;
				task.estimatedCost  = taskDetailsJson.estimatedCost;
				task.estimatedDays  = taskDetailsJson.estimatedDays;
				task.daysRemaining  = taskDetailsJson.daysRemaining;
				task.updatedBy  = userId;
				task.updateDate  = new Date();
				
				siteData.save(function(err, obj){
					if (err) {
						res.json({ success: true, operation: false });
					} else {
						logger.log('Task Updated successfully');
						emailHandler({
						//Container
							targeted: false,
							targetedTo: '',						
							siteId: siteId,
							notificationKey: notificationDataJson.key,
							subject: notificationDataJson.subject,
							content: notificationDataJson.message,
							toIdList: []
						},{
							//Call Back
							success: function(r){
								logger.log('Email Sent Successfully');
								res.json({ success: true, operation: true});
							}, failure: function(){
								logger.log('Email Not Sent. But it is still a Successfull Data Entry');
								res.json({ success: true , operation: true});
							}
						});
					}
				});
			}
		});
	});
});	

//Update Task Status
router.post('/updatetaskstatus', function(req, res) {
	var userId = req.body.userId || req.query.userId;
	var siteId = req.body.siteId || req.query.siteId;
	var taskDetails = req.body.taskDetails || req.query.taskDetails;
	var notificationData = req.body.notificationData || req.query.notificationData;
	
    var taskDetailsJson = JSON.parse(taskDetails); 
	
	var notificationDataJson = JSON.parse(notificationData);

	cnstrntSite.findOne({siteId: siteId}, function(err, siteData){
		siteData.taskList.forEach(function(task){
			if(task.taskId == taskDetailsJson.taskId){
				task.taskStatus  = taskDetailsJson.taskStatus;
				task.updatedBy   = userId;
				task.updateDate  = new Date();
				siteData.save(function(err, obj){
					if (err) {
						res.json({ success: true, operation: false });
					} else {
						logger.log('Task Updated successfully');
						if(task.taskStatus == 'Complete'){
							//Reclaim Inventory to Global Inventory
							siteInventory.findOne({'siteId': siteId, taskId: taskDetailsJson.taskId}, function(err, inventoryData){
								var inventory = inventoryData.inventory;
								globalInventory.findOne({configId: "ITEM"},function(err, globalData) {
									var newRequestList = [];
									for(var i = 0; i<inventory.length; i++){
										if(inventory[i].quantity > 0){
											var found = false;
											for(var j = 0; j<globalData.items.length; j++){
												//Save Global Items in their own Site Locations
												if(inventory[i].item == globalData.items[j].item && 
												   siteId == globalData.items[j].currentLocation){
													 globalData.items[j].quantity = eval(globalData.items[j].quantity) + eval(inventory[i].quantity);
													 found = true;
												} 
											}
											if(!found){
												globalData.items[globalData.items.length] = {
													item: inventory[i].item,
													uom: inventory[i].uom,
													quantity: inventory[i].quantity,
													currentLocation: siteId
												};
											}
											inventory[i].quantity = 0;
											inventory[i].releasedBy = 'System';
											inventory[i].releaseDate = new Date();
										}
										//Reject All Pending Requests for Items in Task Inventory
										if(inventory[i].requests.length == 0){
											newRequestList = globalData.requests;
										} else {
											for(var j = 0; j<inventory[i].requests.length; j++){
												inventory[i].requests[j].requestStatus = 'Cancelled';
												inventory[i].requests[j].rejected = true;
												inventory[i].requests[j].rejectedBy = 'System';
												inventory[i].requests[j].rejectionDate = new Date();
												for(var k = 0; k<globalData.requests.length; k++){
													//Remove All Rejected Requests for a Completed Task
													if(inventory[i].requests[j].requestId != globalData.requests[k].requestId){
														newRequestList[newRequestList.length] = globalData.requests[k];
													}
												}
											}
										}
									}
									inventoryData.save(function(err, obj) {
										if (err) {
											res.json({ success: true, operation: false });
										} else {
											logger.log('Invetory Updated successfully');
											globalData.save(function(err, obj) {
												if (err) {
													res.json({ success: true, operation: false });
												} else {
													logger.log('Global Inventory saved successfully');
													emailHandler({
													//Container
														siteId: siteId,
														notificationKey: notificationDataJson.key,
														subject: notificationDataJson.subject,
														content: notificationDataJson.message,
														toIdList: []
													},{
														//Call Back
														success: function(r){
															logger.log('Email Sent Successfully');
															res.json({ success: true, operation: true});
														}, failure: function(){
															logger.log('Email Not Sent. But it is still a Successfull Data Entry');
															res.json({ success: true , operation: true});
														}
													});
												}
											});
										}
									});
								});
							});
						} else {
							emailHandler({
							//Container
								targeted: false,
								targetedTo: '',									
								siteId: siteId,
								notificationKey: notificationDataJson.key,
								subject: notificationDataJson.subject,
								content: notificationDataJson.message,
								toIdList: []
							},{
								//Call Back
								success: function(r){
									logger.log('Email Sent Successfully');
									res.json({ success: true, operation: true});
								}, failure: function(){
									logger.log('Email Not Sent. But it is still a Successfull Data Entry');
									res.json({ success: true , operation: true});
								}
							});
						}
					}
				});
			}
		});
	});
});	

//Inventory Set Up
router.get('/loadglobaliteminventoryconfig', function(req, res) {
  globalInventory.findOne({configId: "ITEM"},function(err, configData) {
	res.json({success: true, data: configData});
  });
});

router.post('/saveglobalinventoryrequest', function(req, res) {
	var userId = req.body.userId || req.query.userId;
	var requestData = req.body.requestData || req.query.requestData;
    var notificationData = req.body.notificationData || req.query.notificationData;
    
	var notificationDataJson = JSON.parse(notificationData);	
    var requestDataJson = JSON.parse(requestData); 
	requestDataJson.requestedBy = userId;
	requestDataJson.requestDate = new Date();
	//Add Request Data
	globalInventory.findOne({configId: 'ITEM'}, function(err, globalDataSet){
		if(!err){
			globalDataSet.requests.push(requestDataJson);
			globalDataSet.save(function(err1, obj){
				if (!err1) {
					siteInventory.findOne({ 'siteId': requestDataJson.siteId, 'taskId': requestDataJson.taskId }, function(err2, taskInventory) {
						if(!err2){
							taskInventory.inventory.forEach(function(item){
								if(item.item == requestDataJson.item){
									let existingOpneRequests = false;
									item.requests.forEach(function(_r){
										if(!_r.approved || _r.requestStatus != 'Complete' && !_r.rejected){
											existingOpneRequests = true;
										}
										return;
									});
									if(!existingOpneRequests){
										item.requests.push(requestDataJson);
									}									
								}
							});	
							taskInventory.save(function(err3, obj2){
								logger.log('Request Registered successfully');
								emailHandler({
								//Container
									targeted: false,
									targetedTo: '',													
									siteId: requestDataJson.siteId,
									notificationKey: notificationDataJson.key,
									subject: notificationDataJson.subject,
									content: notificationDataJson.message,
									toIdList: []
								},{
									//Call Back
									success: function(r){
										logger.log('Email Sent Successfully');
										res.json({ success: true, operation: true });
									}, failure: function(){
										logger.log('Email Not Sent. But it is still a Successfull Data Entry');
										res.json({ success: true , operation: true});
									}
								});
							});								
						} else res.json({ success: true, operation: false });
					});
				} else {
					res.json({ success: true, operation: false });
				}
			});
		} else res.json({ success: true , operation: true});
	});
});

router.post('/rejectglobalinventoryrequests', function(req, res) {
	var userId = req.body.userId || req.query.userId;
	var rejectedRequest = req.body.rejectedRequest || req.query.rejectedRequest;
    var notificationData = req.body.notificationData || req.query.notificationData;
    
	var notificationDataJson = JSON.parse(notificationData);
	
	var rejectedRequestJson = JSON.parse(rejectedRequest); 
	//Update Request Data
	globalInventory.findOne({configId: 'ITEM'}, function(err, globalDataSet){
		if(!err){
			let found = false;
			globalDataSet.requests.forEach(function(_request){
				if(_request.requestId == rejectedRequestJson.requestId && !_request.approved){
					globalDataSet.requests.pull({requestId: _request.requestId});
				}
			});
			globalDataSet.save(function(err1, obj){
				if (!err1) {
					siteInventory.findOne({ 'siteId': rejectedRequestJson.siteId, 'taskId': rejectedRequestJson.taskId }, function(err2, taskInventory) {
						if(!err2){
							taskInventory.inventory.forEach(function(item){
								if(item.item == rejectedRequestJson.item){
									item.requests.forEach(function(_r){
										if(_r.requestId == rejectedRequestJson.requestId){
											_r.requestStatus = 'Rejected';
											_r.rejected = true;
											_r.rejectedBy = userId;
											_r.rejectionDate = new Date();
										}
									});
								}
							});
							taskInventory.save(function(err4, obj2){
								logger.log('Request Registered successfully');
								emailHandler({
								//Container
									targeted: true,
									targetedTo: rejectedRequestJson.requestedBy,
									siteId: rejectedRequestJson.siteId,
									notificationKey: notificationDataJson.key,
									subject: notificationDataJson.subject,
									content: notificationDataJson.message,
									toIdList: []
								},{
									//Call Back
									success: function(r){
									console.log('End !!!!!');
										if(!found) found = true;
										logger.log('Email Sent Successfully');
										res.json({ success: true, operation: true });
									}, failure: function(){
										logger.log('Email Not Sent. But it is still a Successfull Data Entry');
										res.json({ success: true , operation: true});
									}
								});
							});								
						} else res.json({ success: true, operation: false });									
					});
				} else  res.json({ success: true, operation: false });
			});			
		} else res.json({ success: true , operation: false});
	});
});

router.post('/updatesiterequestdetailsallocate', function(req, res) {
  var userId = req.body.userId || req.query.userId;	
  var requestData = req.body.requestData || req.query.requestData;
  var requestDataJson = JSON.parse(requestData);
  siteInventory.findOne({ 'siteId': requestDataJson.siteId, 'taskId': requestDataJson.taskId }, function(err, taskInventory) {
	  if(!err){
		taskInventory.inventory.forEach(function(item){
			if(item.item == requestDataJson.item){
				item.requests.forEach(function(_request){
					if(_request.requestId == requestDataJson.requestId && _request.requestStatus == 'Open'){
						_request.requestStatus = 'Allocated';
						_request.quantity = Number(requestDataJson.quantity);					
					}
				});
			} 
		});
		taskInventory.save(function(err2, obj){
			if(err2){
				res.json({ success: true , operation: false});
			} else {
				res.json({ success: true , operation: true });
			}
		});			
	  }
	  else res.json({ success: true , operation: false});
  });
});

router.post('/updatesiterequestdetailsship', function(req, res) {
  var userId = req.body.userId || req.query.userId;	
  var requestData = req.body.requestData || req.query.requestData;
  var requestDataJson = JSON.parse(requestData);
  siteInventory.findOne({ 'siteId': requestDataJson.siteId, 'taskId': requestDataJson.taskId }, function(err, taskInventory) {
	  if(!err){
		taskInventory.inventory.forEach(function(item){
			if(item.item == requestDataJson.item){
				item.requests.forEach(function(_request){
					if(_request.requestId == requestDataJson.requestId && _request.requestStatus == 'Allocated'){
						_request.requestStatus = 'Shipped';
						_request.quantity = Number(requestDataJson.quantity);
						_request.transferOrder.transferOrderId = requestDataJson.transferOrder.transferOrderId;
						_request.transferOrder.shippingVendor = requestDataJson.transferOrder.shippingVendor;
						_request.transferOrder.shippingType = requestDataJson.transferOrder.shippingType;
						_request.transferOrder.trackingId = requestDataJson.transferOrder.trackingId;
						_request.transferOrder.shippingCost = requestDataJson.transferOrder.shippingCost;
						_request.transferOrder.estimatedDeliveryDays = requestDataJson.transferOrder.estimatedDeliveryDays;
					}
				});
			} 
		});
		taskInventory.save(function(err2, obj){
			if(err2){
				res.json({ success: true , operation: false});
			} else {
				res.json({ success: true , operation: true });
			}
		});			
	  }
	  else res.json({ success: true , operation: false});
  });
});

router.post('/approveglobalinventoryrequests', function(req, res) {
	var userId = req.body.userId || req.query.userId;
	var requestData = req.body.requestData || req.query.requestData;
    var notificationData = req.body.notificationData || req.query.notificationData;
    
	var notificationDataJson = JSON.parse(notificationData);
	
	var requestDataJson = JSON.parse(requestData); 
	//Update Request Data
	globalInventory.findOne({configId: 'ITEM'}, function(err, globalDataSet){
		if(!err){
			let _r = {};
			let _message = 'Allocation Successful';
			globalDataSet.requests.forEach(function(_request){
				if(_request.requestId == requestDataJson.requestId && _request.requestStatus == 'Open'){
					let removeItem = false;
					globalDataSet.items.forEach(function(_item){
						//Assign Quantity from 
						if(_item.item == requestDataJson.item && _item.currentLocation == requestDataJson.currentLocation && _request.requestStatus == 'Open'){
							if(Number(_item.quantity) >= Number(requestDataJson.quantity)){
								//Stop Negative Allocation
								_item.quantity =  Number(_item.quantity) - Number(requestDataJson.quantity);
								_request.quantity = Number(requestDataJson.quantity);
								_request.requestStatus = 'Allocated';
								_request.approved = true;								
							} else {
								_message = 'Inventry Quantity is enough to fullfill this Request. Change Allocation';
							}
						}
					});
					_r = _request;
				}
			});
			globalDataSet.save(function(err1, obj){
				if (!err1) {
					res.json({ success: true, operation: true, _items: globalDataSet.items, _requests: globalDataSet.requests, _request: _r, message: _message});
				} else  res.json({ success: true, operation: false });
			});			
		} else res.json({ success: true , operation: false});
	});
});

router.post('/shipglobalinventoryrequests', function(req, res) {
	var userId = req.body.userId || req.query.userId;
	var requestData = req.body.requestData || req.query.requestData;
    var notificationData = req.body.notificationData || req.query.notificationData;
    
	var notificationDataJson = JSON.parse(notificationData);
	
	var requestDataJson = JSON.parse(requestData); 
	//Update Request Data
	globalInventory.findOne({configId: 'ITEM'}, function(err, globalDataSet){
		if(!err){
			let _r = {};
			globalDataSet.requests.forEach(function(_request){
				if(_request.requestId == requestDataJson.requestId && _request.approved && _request.requestStatus == 'Allocated'){
					_request.requestStatus = 'Shipped';
					_request.quantity = Number(requestDataJson.quantity);
					_request.transferOrder.transferOrderId = requestDataJson.transferOrder.transferOrderId;
					_request.transferOrder.shippingVendor = requestDataJson.transferOrder.shippingVendor;
					_request.transferOrder.shippingType = requestDataJson.transferOrder.shippingType;
					_request.transferOrder.trackingId = requestDataJson.transferOrder.trackingId;
					_request.transferOrder.shippingCost = requestDataJson.transferOrder.shippingCost;
					_r = _request;
				}
			});
			globalDataSet.save(function(err1, obj){
				if (!err1) {
					res.json({ success: true, operation: true, _items: globalDataSet.items, _requests: globalDataSet.requests, _request: _r});
				} else  res.json({ success: true, operation: false });
			});
		} else res.json({ success: true , operation: false});
	});
});

router.get('/loaditeminventoryconfig', function(req, res) {
  inventoryConfig.findOne({configId: "ITEM"},function(err, configData) {
	  if(!err){
		res.json({success: true, data: configData});
	  } else res.json({success: true, data: []});
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

router.post('/reconsileinventorycostsandpayments', function(req, res) {
  var userId = req.body.userId || req.query.userId;	
  var siteId = req.body.siteId || req.query.siteId;	
  var taskId = req.body.taskId || req.query.taskId;
  cnstrntSite.findOne({siteId: siteId}, function(err, siteTaskMap){
	if(err)
		res.json({ success: true , operation: false});
	else {
		siteInventory.findOne({ 'siteId': siteId, 'taskId': taskId }, function(err2, taskInventory) {
			if(err)
				res.json({ success: true , operation: false});
			siteTaskMap.taskList.forEach(function(task){
				if(task.taskId == taskId){
					let actualCost = 0;
					let totalPayment = 0;
					taskInventory.inventory.forEach(function(item){
						//Sum Up all Costs for Task
						actualCost = eval(actualCost) + eval(item.totalPrice);
						totalPayment = eval(totalPayment) + eval(item.totalPayment);
					});
					task.actualInventoryCost = actualCost;
					task.totalInventoryPayment = totalPayment;					
				}
			});	
			siteTaskMap.save(function(err2, obj){
				res.json({ success: true , operation: true});
			});					
		});	
	}
  });
});

router.post('/reconsilelabourbillsandpayments', function(req, res) {
  var userId = req.body.userId || req.query.userId;	
  var siteId = req.body.siteId || req.query.siteId;	
  var taskId = req.body.taskId || req.query.taskId;
  cnstrntSite.findOne({siteId: siteId}, function(err, siteTaskMap){
	if(err)
		res.json({ success: true , operation: false}); 
	else
    siteLabour.findOne({ 'siteId': siteId, 'taskId': taskId }, function(err2, taskLabour) {
	    if(err2)
			res.json({ success: true , operation: false}); 
		siteTaskMap.taskList.forEach(function(task){
			if(task.taskId == taskId){
				let actualCost = 0;
				let totalPayment = 0;
				let totalLabour = 0;
				taskLabour.labour.forEach(function(labour){
					//Sum Up all Costs for Task
					actualCost = eval(actualCost) + eval(labour.totalBill);
					totalPayment = eval(totalPayment) + eval(labour.totalPayment);
					if(labour.active){
						//Consider only Active Labour
						totalLabour = eval(totalLabour) + eval(labour.count);
					}
				});
				task.actualLabourCost = actualCost;
				task.totalLabourPayment = totalPayment;
				task.totalLabour = totalLabour;
			}
		});
		siteTaskMap.save(function(err3, obj){
			res.json({ success: true , operation: true});
		});
	});	
  });
});

//Load Inventory
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

//Add Inventory Item
router.post('/addinventory', function(req, res) {
  var userId = req.body.userId || req.query.userId;	
  var siteId = req.body.siteId || req.query.siteId;	
  var taskId = req.body.taskId || req.query.taskId;
  var newInventory = req.body.newInventory || req.query.newInventory;
  var notificationData = req.body.notificationData || req.query.notificationData;
  
  var inventoryDataJson = JSON.parse(newInventory); 
  inventoryDataJson.createdBy = userId;
  inventoryDataJson.createDate = new Date();
  
  var notificationDataJson = JSON.parse(notificationData);
  
  siteInventory.findOne({ 'siteId': siteId, 'taskId': taskId }, function(err, taskInventory) {
	  if(!err){
		taskInventory.inventory.push(inventoryDataJson);
		taskInventory.save(function(err2, obj){
			emailHandler({
			//Container
				targeted: false,
				targetedTo: '',					
				siteId: siteId,
				notificationKey: notificationDataJson.key,
				subject: notificationDataJson.subject,
				content: notificationDataJson.message,
				toIdList: []
			},{
				//Call Back
				success: function(r){
					logger.log('Email Sent Successfully');
					res.json({ success: true, operation: true });
				}, failure: function(){
					logger.log('Email Not Sent. But it is still a Successfull Data Entry');
					res.json({ success: true , operation: true});
				}
			});
		});
	  }
	  else res.json({ success: true , operation: true});
  });
});

router.post('/approveinventory', function(req, res) {
  var userId = req.body.userId || req.query.userId;	
  var siteId = req.body.siteId || req.query.siteId;	
  var taskId = req.body.taskId || req.query.taskId;
  var selectedItem = req.body.selectedItem || req.query.selectedItem;
  var notificationData = req.body.notificationData || req.query.notificationData;
  
  var notificationDataJson = JSON.parse(notificationData);
  
  siteInventory.findOne({ 'siteId': siteId, 'taskId': taskId }, function(err, taskInventory) {
	  if(!err){
		taskInventory.inventory.forEach(function(item){
			if(item.item == selectedItem){
				item.approved = true;
				item.approvedBy = userId;
				item.approvalDate = new Date();
			}		
		});
		taskInventory.save(function(err2, obj){
			emailHandler({
			//Container
				targeted: false,
				targetedTo: '',		
				siteId: siteId,
				notificationKey: notificationDataJson.key,
				subject: notificationDataJson.subject,
				content: notificationDataJson.message,
				toIdList: []
			},{
				//Call Back
				success: function(r){
					logger.log('Email Sent Successfully');
					res.json({ success: true, operation: true });
				}, failure: function(){
					logger.log('Email Not Sent. But it is still a Successfull Data Entry');
					res.json({ success: true , operation: true});
				}
			});
		});		
	  }
	  else res.json({ success: true , operation: false});
  });
});

router.post('/releaseinventory', function(req, res) {
  var userId = req.body.userId || req.query.userId;	
  var siteId = req.body.siteId || req.query.siteId;	
  var taskId = req.body.taskId || req.query.taskId;
  var selectedItem = req.body.selectedItem || req.query.selectedItem;
  var notificationData = req.body.notificationData || req.query.notificationData;
  
  var notificationDataJson = JSON.parse(notificationData);
  
  siteInventory.findOne({ 'siteId': siteId, 'taskId': taskId }, function(err, taskInventory) {
	  if(!err){
		globalInventory.findOne({configId: "ITEM"},function(err1, globalData) {
			if(err1) res.json({ success: true , operation: false});
			else {
				taskInventory.inventory.forEach(function(item){
					if(item.item == selectedItem && item.approved){
						var found = false;
						for(var j = 0; j<globalData.items.length; j++){
							//Save Global Items in their own Site Locations
							if(item.item == globalData.items[j].item && 
							   siteId == globalData.items[j].currentLocation){
								 globalData.items[j].quantity = eval(globalData.items[j].quantity) + eval(item.quantity);
								 found = true;
							} 
						}
						if(!found){
							globalData.items[globalData.items.length] = {
								item: item.item,
								uom: item.uom,
								quantity: item.quantity,
								currentLocation: siteId
							};
						}
						item.quantity = 0;
						item.releasedBy = userId;
						item.releaseDate = new Date();
					}		
				});
				taskInventory.save(function(err2, obj){
					if(err2) res.json({ success: true , operation: false});
					else
					globalData.save(function(err3, obj){
						res.json({ success: true , operation: true});	
					});
				});
			}
		});	
	  }
	  else res.json({ success: true , operation: false});
  });
});

router.post('/addinventoryorder', function(req, res) {
  var userId = req.body.userId || req.query.userId;	
  var siteId = req.body.siteId || req.query.siteId;	
  var taskId = req.body.taskId || req.query.taskId;
  var selectedItem = req.body.selectedItem || req.query.selectedItem;
  
  var newOrder = req.body.newOrder || req.query.newOrder;
  
  var notificationData = req.body.notificationData || req.query.notificationData;
  
  var newOrderJson = JSON.parse(newOrder); 
  newOrderJson.createdBy = userId;
  newOrderJson.createDate = new Date();
  var notificationDataJson = JSON.parse(notificationData);
  
  siteInventory.findOne({ 'siteId': siteId, 'taskId': taskId }, function(err, taskInventory) {
	  if(!err){
		let _orders = [];
		taskInventory.inventory.forEach(function(item){
			if(item.item == selectedItem){
				item.orders.push(newOrderJson);
				_orders = item.orders;
			} 
		});
		taskInventory.save(function(err2, obj){
			emailHandler({
			//Container
				targeted: false,
				targetedTo: '',							
				siteId: siteId,
				notificationKey: notificationDataJson.key,
				subject: notificationDataJson.subject,
				content: notificationDataJson.message,
				toIdList: []
			},{
				//Call Back
				success: function(r){
					logger.log('Email Sent Successfully');
					res.json({ success: true, operation: true, orders: _orders });
				}, failure: function(){
					logger.log('Email Not Sent. But it is still a Successfull Data Entry');
					res.json({ success: true , operation: true, orders: _orders });
				}
			});
		});
	  }
	  else res.json({ success: true , operation: false});
  });
});

router.post('/deleteinventoryorder', function(req, res) {
  var userId = req.body.userId || req.query.userId;	
  var siteId = req.body.siteId || req.query.siteId;	
  var taskId = req.body.taskId || req.query.taskId;
  var selectedItem = req.body.selectedItem || req.query.selectedItem;
  
  var orderData = req.body.orderData || req.query.orderData;
  
  var notificationData = req.body.notificationData || req.query.notificationData;

  var notificationDataJson = JSON.parse(notificationData);
  var orderDataJson = JSON.parse(orderData); 
  
  siteInventory.findOne({ 'siteId': siteId, 'taskId': taskId }, function(err, taskInventory) {
	  if(!err){
		taskInventory.inventory.forEach(function(item){
			if(item.item == selectedItem){
				item.orders.pull({orderId: orderDataJson.orderId, approved: false});
			} 
		});
		taskInventory.save(function(err2, obj){
			//Fetch Latest Data. Pull does not reflect until Saved!
			siteInventory.findOne({ 'siteId': siteId, 'taskId': taskId }, function(err, taskInventory2) {
				let _orders = [];
				taskInventory2.inventory.forEach(function(item2){
					if(item2.item == selectedItem){
						_orders = item2.orders;
					}
				});
				emailHandler({
				//Container
					targeted: false,
					targetedTo: '',										
					siteId: siteId,
					notificationKey: notificationDataJson.key,
					subject: notificationDataJson.subject,
					content: notificationDataJson.message,
					toIdList: []
				},{
					//Call Back
					success: function(r){
						logger.log('Email Sent Successfully');
						res.json({ success: true, operation: true, orders: _orders });
					}, failure: function(){
						logger.log('Email Not Sent. But it is still a Successfull Data Entry');
						res.json({ success: true , operation: true, orders: _orders });
					}
				});				
			});
		});
	  }
	  else res.json({ success: true , operation: false});
  });
});

router.post('/completeinventoryorder', function(req, res) {
  var userId = req.body.userId || req.query.userId;	
  var siteId = req.body.siteId || req.query.siteId;	
  var taskId = req.body.taskId || req.query.taskId;
  var selectedItem = req.body.selectedItem || req.query.selectedItem;
  
  var orderData = req.body.orderData || req.query.orderData;
  
  var notificationData = req.body.notificationData || req.query.notificationData;

  var notificationDataJson = JSON.parse(notificationData);
  var orderDataJson = JSON.parse(orderData); 
  
  siteInventory.findOne({ 'siteId': siteId, 'taskId': taskId }, function(err, taskInventory) {
	  if(!err){
		var _orders = [];
		taskInventory.inventory.forEach(function(item){
			if(item.item == selectedItem){
				item.orders.forEach(function(order){
					if(order.orderId == orderDataJson.orderId){
						order.orderStatus = 'Complete';
						order.updatedBy = userId;
						order.updateDate = new Date();
					}
				});
				_orders = item.orders;
			} 
		});
		taskInventory.save(function(err, obj){
			emailHandler({
			//Container
				targeted: false,
				targetedTo: '',									
				siteId: siteId,
				notificationKey: notificationDataJson.key,
				subject: notificationDataJson.subject,
				content: notificationDataJson.message,
				toIdList: []
			},{
				//Call Back
				success: function(r){
					logger.log('Email Sent Successfully');
					res.json({ success: true, operation: true, orders: _orders });
				}, failure: function(){
					logger.log('Email Not Sent. But it is still a Successfull Data Entry');
					res.json({ success: true , operation: true, orders: _orders });
				}
			});
		});
	  }
	  else res.json({ success: true , operation: false});
  });
});

router.post('/approveinventoryorder', function(req, res) {
  var userId = req.body.userId || req.query.userId;	
  var siteId = req.body.siteId || req.query.siteId;	
  var taskId = req.body.taskId || req.query.taskId;
  var selectedItem = req.body.selectedItem || req.query.selectedItem;
  
  var orderData = req.body.orderData || req.query.orderData;
  
  var notificationData = req.body.notificationData || req.query.notificationData;

  var notificationDataJson = JSON.parse(notificationData);
  var orderDataJson = JSON.parse(orderData);
  
  siteInventory.findOne({ 'siteId': siteId, 'taskId': taskId }, function(err, taskInventory) {
	  if(!err){
		var _item = {};
		taskInventory.inventory.forEach(function(item){
			if(item.item == selectedItem){
				item.orders.forEach(function(order){
					if(order.orderId == orderDataJson.orderId && !order.approved && order.orderStatus == 'Complete' ){
						order.approved = true;
						order.approvedBy = userId;
						order.approvalDate = new Date();
						
						//Update Total Price
						item.totalPrice = eval(item.totalPrice) + eval(orderDataJson.totalPrice);
						//Add Quantity to Inventory
						item.quantity = eval(item.quantity) + eval(orderDataJson.quantity);
					}
				});
				_item = item;
			} 
		});	
		taskInventory.save(function(err2, obj){
			emailHandler({
			//Container
				targeted: true,
				targetedTo: orderData.createdBy,									
				siteId: siteId,
				notificationKey: notificationDataJson.key,
				subject: notificationDataJson.subject,
				content: notificationDataJson.message,
				toIdList: []
			},{
				//Call Back
				success: function(r){
					logger.log('Email Sent Successfully');
					res.json({ success: true, operation: true, item: _item });
				}, failure: function(){
					logger.log('Email Not Sent. But it is still a Successfull Data Entry');
					res.json({ success: true , operation: true, item: _item });
				}
			});
		});
	  }
	  else res.json({ success: true , operation: false});
  });
});

router.post('/cancelinventoryrequest', function(req, res) {
  var userId = req.body.userId || req.query.userId;	
  var requestData = req.body.requestData || req.query.requestData;
  var requestDataJson = JSON.parse(requestData);
  
  siteInventory.findOne({ 'siteId': requestDataJson.siteId, 'taskId': requestDataJson.taskId }, function(err, taskInventory) {
	  if(!err){
		var _item = {};
		var _r = {};
		taskInventory.inventory.forEach(function(item){
			if(item.item == requestDataJson.item){
				item.requests.forEach(function(_request){
					if(_request.requestId == requestDataJson.requestId && _request.requestStatus == 'Rejected'){
						_request.requestStatus = 'Cancelled';
						_r = _request;
					}
				});
				_item = item;
			} 
		});
		taskInventory.save(function(err2, obj){
			res.json({ success: true , operation: true, request: _r, item: _item});
		});
	  }
	  else res.json({ success: true , operation: false});
  });
});

router.post('/deleteglobalrequestdetails', function(req, res) {
  var userId = req.body.userId || req.query.userId;	
  var requestData = req.body.requestData || req.query.requestData;
  var requestDataJson = JSON.parse(requestData);
  
  globalInventory.findOne({configId: 'ITEM'}, function(err, globalDataSet){
	  if(!err){
		globalDataSet.requests.forEach(function(_request){
			if(_request.requestId == requestDataJson.requestId){
				if(_request.transfer &&_request.requestStatus == 'Shipped'){
					globalDataSet.requests.pull({requestId: _request.requestId});
				} else if(!_request.transfer && _request.requestStatus == 'Allocated'){
					globalDataSet.requests.pull({requestId: _request.requestId});
				}
			}
		});
		globalDataSet.save(function(err2, obj){
			res.json({ success: true , operation: true});
		});
	 } else res.json({ success: true , operation: false});
  });
});

router.post('/receiveinventoryrequest', function(req, res) {
  var userId = req.body.userId || req.query.userId;	
  var requestData = req.body.requestData || req.query.requestData;
  var requestDataJson = JSON.parse(requestData);
  
  siteInventory.findOne({ 'siteId': requestDataJson.siteId, 'taskId': requestDataJson.taskId }, function(err, taskInventory) {
	  if(!err){
		var _item = {};
		var _r = {};
		taskInventory.inventory.forEach(function(item){
			if(item.item == requestDataJson.item){
				item.requests.forEach(function(_request){
					if(_request.requestId == requestDataJson.requestId && _request.requestStatus == 'Shipped'){
						_request.requestStatus = 'Received';
						_r = _request;
					}
				});
				_item = item;
			} 
		});
		taskInventory.save(function(err, obj){
			res.json({ success: true , operation: true, request: _r, item: _item});
		});
	  }
	  else res.json({ success: true , operation: false});
  });
});

router.post('/approveinventoryrequest', function(req, res) {
  var userId = req.body.userId || req.query.userId;	
  var requestData = req.body.requestData || req.query.requestData;
  var requestDataJson = JSON.parse(requestData);
  siteInventory.findOne({ 'siteId': requestDataJson.siteId, 'taskId': requestDataJson.taskId }, function(err, taskInventory) {
	  if(!err){
		var _item = {};
		var _r = {};
		taskInventory.inventory.forEach(function(item){
			if(item.item == requestDataJson.item){
				item.requests.forEach(function(_request){
					/*
						Same Site Requests are Complete the moment they are Acquired
					*/
					if(!_request.transfer && _request.requestId == requestDataJson.requestId && _request.requestStatus == 'Allocated'){
						_request.requestStatus = 'Complete';
						_request.approved = true;
						_request.approvedBy = userId;
						_request.approvalDate = new Date();	
						item.quantity = Number(item.quantity) + Number(_request.quantity);						
						_r = _request;
					}
					else if(_request.transfer && _request.requestId == requestDataJson.requestId && _request.requestStatus == 'Received'){
						_request.requestStatus = 'Approved';
						_request.approved = true;
						_request.approvedBy = userId;
						_request.approvalDate = new Date();
						//Update Total Price
						item.totalPrice = Number(item.totalPrice) + Number(_request.transferOrder.shippingCost);
						//Add Quantity to Inventory
						item.quantity = Number(item.quantity) + Number(_request.quantity);
						_r = _request;
					}
				});
				_item = item;
			} 
		});
		taskInventory.save(function(err2, obj){
			if(err2){
				res.json({ success: true , operation: false});
			} else {
				res.json({ success: true , operation: true, request: _r, item: _item });
			}
		});			
	  }
	  else res.json({ success: true , operation: false});
  });
});

router.post('/payinventoryorder', function(req, res) {
  var userId = req.body.userId || req.query.userId;	
  var siteId = req.body.siteId || req.query.siteId;	
  var taskId = req.body.taskId || req.query.taskId;
  
  var orderId = req.body.orderId || req.query.orderId;
	
  var selectedItem = req.body.selectedItem || req.query.selectedItem;
  
  var paymentData = req.body.paymentData || req.query.paymentData;
  
  var notificationData = req.body.notificationData || req.query.notificationData;

  var notificationDataJson = JSON.parse(notificationData);
  var paymentDataJson = JSON.parse(paymentData);
  
  siteInventory.findOne({ 'siteId': siteId, 'taskId': taskId }, function(err, taskInventory) {
	  if(!err){
		var _item = {};
		taskInventory.inventory.forEach(function(item){
			if(item.item == selectedItem){
				item.orders.forEach(function(order){
					if(order.orderId == orderId && order.approved && order.orderStatus == 'Complete' ){
						let totalPayment = 0;
						order.payments.forEach(function(payment){
							totalPayment = eval(payment.payment);
						});
						let balance = eval(order.totalPrice) - eval(totalPayment);
						if(eval(paymentDataJson.paidAmount) > balance){
							return res.json({ success: true, operation: true, item: item , dispute: true});
						} else {
							order.payments.push({
								paymentId: paymentDataJson.paymentId,
								payment: paymentDataJson.paidAmount,
								paidBy: userId,
								paymentDate: new Date()	
							});
							order.totalPayment = eval(order.totalPayment) + eval(paymentDataJson.paidAmount);
							item.totalPayment = eval(item.totalPayment) + eval(paymentDataJson.paidAmount);
						}
					}
				});
				_item = item;
			} 
		});
		taskInventory.save(function(err, obj){
			emailHandler({
			//Container
				targeted: false,
				targetedTo: '',								
				siteId: siteId,
				notificationKey: notificationDataJson.key,
				subject: notificationDataJson.subject,
				content: notificationDataJson.message,
				toIdList: []
			},{
				//Call Back
				success: function(r){
					logger.log('Email Sent Successfully');
					res.json({ success: true, operation: true, item: _item, dispute: false });
				}, failure: function(){
					logger.log('Email Not Sent. But it is still a Successfull Data Entry');
					res.json({ success: true , operation: true, item: _item, dispute: false});
				}
			});
		});
	  }
	  else res.json({ success: true , operation: false});
  });
});

router.post('/payinventoryrequest', function(req, res) {
  var userId = req.body.userId || req.query.userId;	
  var requestData = req.body.requestData || req.query.requestData;
  var requestDataJson = JSON.parse(requestData);
  
  siteInventory.findOne({ 'siteId': requestDataJson.siteId, 'taskId': requestDataJson.taskId }, function(err, taskInventory) {
	  if(!err){
		var _item = {};
		var _r = {};
		taskInventory.inventory.forEach(function(item){
			if(item.item == requestDataJson.item){
				item.requests.forEach(function(_request){
					if(_request.requestId == requestDataJson.requestId && _request.requestStatus == 'Approved'){
						if(Number(_request.transferOrder.payment) == 0){
							_request.requestStatus = 'Complete';
							_request.transferOrder.payment = Number(_request.transferOrder.shippingCost);
							item.totalPayment = Number(item.totalPayment) + Number(_request.transferOrder.payment);
							_r = _request;
						}
					}
				});
				_item = item;
			} 
		});
		taskInventory.save(function(err2, obj){
			if(!err2)
				res.json({ success: true , operation: true, request: _r, item: _item});
			else {
				console.log(err2);
				res.json({ success: true , operation: false});
			}
		});
	  }
	  else res.json({ success: true , operation: false});
  });
});


//Load Labour
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

//Add Labour Data
router.post('/addlabour', function(req, res) {
  var userId = req.body.userId || req.query.userId;	
  var siteId = req.body.siteId || req.query.siteId;	
  var taskId = req.body.taskId || req.query.taskId;
  var newLabour = req.body.newLabour || req.query.newLabour;
  var notificationData = req.body.notificationData || req.query.notificationData;
  
  var newLabourJson = JSON.parse(newLabour); 
  newLabourJson.createdBy = userId;
  newLabourJson.createDate = new Date();
  
  var notificationDataJson = JSON.parse(notificationData);
  
  siteLabour.findOne({ 'siteId': siteId, 'taskId': taskId }, function(err, taskLabour) {
	  if(!err){
		taskLabour.labour.push(newLabourJson);
		taskLabour.save(function(err, obj){
			emailHandler({
			//Container
				targeted: false,
				targetedTo: '',
				siteId: siteId,
				notificationKey: notificationDataJson.key,
				subject: notificationDataJson.subject,
				content: notificationDataJson.message,
				toIdList: []
			},{
				//Call Back
				success: function(r){
					logger.log('Email Sent Successfully');
					res.json({ success: true, operation: true });
				}, failure: function(){
					logger.log('Email Not Sent. But it is still a Successfull Data Entry');
					res.json({ success: true , operation: true});
				}
			});
			
			
		});
	  }
	  else res.json({ success: true , operation: true});
  });
});

//Edit Labour Data
router.post('/editlabour', function(req, res) {
  var userId = req.body.userId || req.query.userId;	
  var siteId = req.body.siteId || req.query.siteId;	
  var taskId = req.body.taskId || req.query.taskId;
  var labourData = req.body.labourData || req.query.labourData;
  
  var notificationData = req.body.notificationData || req.query.notificationData;
  
  var labourDataJson = JSON.parse(labourData); 
  var notificationDataJson = JSON.parse(notificationData);
  
  siteLabour.findOne({ 'siteId': siteId, 'taskId': taskId }, function(err, taskLabour) {
	  if(!err){
		taskLabour.labour.forEach(function(labour){
			if(labour.labourId == labourDataJson.labourId){
				if(labour.approved == labourDataJson.approved && !labour.approved && labour.active == labourDataJson.active){
					//Data Updates
					labour.labourDescription = labourDataJson.labourDescription;
					labour.contractor = labourDataJson.contractor;
					labour.contractType = labourDataJson.contractType;
					labour.rate = labourDataJson.rate;
					labour.count = labourDataJson.count;
					labour.updatedBy = userId;
					labour.updateDate = new Date();
				} else if(labour.approved == labourDataJson.approved && labour.approved && labour.active != labourDataJson.active){
					//Activate /De-Activate
					labour.active = labourDataJson.active;
					labour.updatedBy = userId;
					labour.updateDate = new Date();				
				} else if(labour.approved != labourDataJson.approved && labourDataJson.active){
					//Approval
					labour.approved = labourDataJson.approved;
					labour.approvedBy = userId;
					labour.approvalDate = new Date();				
				}  
			}
		});
		taskLabour.save(function(err, obj){
			emailHandler({
			//Container
				targeted: false,
				targetedTo: '',					
				siteId: siteId,
				notificationKey: notificationDataJson.key,
				subject: notificationDataJson.subject,
				content: notificationDataJson.message,
				toIdList: []
			},{
				//Call Back
				success: function(r){
					logger.log('Email Sent Successfully');
					res.json({ success: true, operation: true });
				}, failure: function(){
					logger.log('Email Not Sent. But it is still a Successfull Data Entry');
					res.json({ success: true , operation: true});
				}
			});
		});		
	  }
	  else res.json({ success: true , operation: true});
  });
});

router.post('/addlabourbilling', function(req, res) {
  var userId = req.body.userId || req.query.userId;	
  var siteId = req.body.siteId || req.query.siteId;	
  var taskId = req.body.taskId || req.query.taskId;
  var labourId = req.body.labourId || req.query.labourId;
  
  var newBill = req.body.newBill || req.query.newBill;
  
  var notificationData = req.body.notificationData || req.query.notificationData;
  
  var newBillJson = JSON.parse(newBill); 
  newBillJson.createdBy = userId;
  newBillJson.createDate = new Date();
  
  var notificationDataJson = JSON.parse(notificationData);
  
  siteLabour.findOne({ 'siteId': siteId, 'taskId': taskId }, function(err, taskLabour) {
	  if(!err){
		var _labour = {};
		taskLabour.labour.forEach(function(labour){
			if(labour.labourId == labourId && labour.active){
				labour.billing.push(newBillJson);
				_labour = labour;
			} 
		});
		taskLabour.save(function(err, obj){
			emailHandler({
			//Container
				targeted: false,
				targetedTo: '',					
				siteId: siteId,
				notificationKey: notificationDataJson.key,
				subject: notificationDataJson.subject,
				content: notificationDataJson.message,
				toIdList: []
			},{
				//Call Back
				success: function(r){
					logger.log('Email Sent Successfully');
					res.json({ success: true, operation: true, labour: _labour });
				}, failure: function(){
					logger.log('Email Not Sent. But it is still a Successfull Data Entry');
					res.json({ success: true , operation: true, labour: _labour });
				}
			});
		});
	  }
	  else res.json({ success: true , operation: false});
  });
});

router.post('/deletelabourbill', function(req, res) {
  var userId = req.body.userId || req.query.userId;	
  var siteId = req.body.siteId || req.query.siteId;	
  var taskId = req.body.taskId || req.query.taskId;
  var labourId = req.body.labourId || req.query.labourId;
  
  var billId = req.body.billId || req.query.billId;
  
  var notificationData = req.body.notificationData || req.query.notificationData;
  
  var notificationDataJson = JSON.parse(notificationData);
  
  siteLabour.findOne({ 'siteId': siteId, 'taskId': taskId }, function(err, taskLabour) {
	  if(!err){
		taskLabour.labour.forEach(function(labour){
			if(labour.labourId == labourId && labour.active){
				labour.billing.forEach(function(bill){
					if(bill.billingId == billId && !bill.approved){
						labour.billing.pull({billingId: bill.billingId});
					}
				});
			} 
		});
		taskLabour.save(function(err, obj){
			//Pull Doesn't Reflect Until Saved!!
			siteLabour.findOne({ 'siteId': siteId, 'taskId': taskId }, function(err, taskLabour2) {
				let _labour = {};
				taskLabour2.labour.forEach(function(labour2){
					if(labour2.labourId == labourId){
						_labour = labour2;
					}
				});
				emailHandler({
				//Container
					targeted: false,
					targetedTo: '',										
					siteId: siteId,
					notificationKey: notificationDataJson.key,
					subject: notificationDataJson.subject,
					content: notificationDataJson.message,
					toIdList: []
				},{
					//Call Back
					success: function(r){
						logger.log('Email Sent Successfully');
						res.json({ success: true, operation: true, labour: _labour });
					}, failure: function(){
						logger.log('Email Not Sent. But it is still a Successfull Data Entry');
						res.json({ success: true , operation: true, labour: _labour });
					}
				});				
			});
		});		
	  }
	  else res.json({ success: true , operation: false});
  });
});

router.post('/editlabourbill', function(req, res) {
  var userId = req.body.userId || req.query.userId;	
  var siteId = req.body.siteId || req.query.siteId;	
  var taskId = req.body.taskId || req.query.taskId;
  var labourId = req.body.labourId || req.query.labourId;
  
  var billData = req.body.billData || req.query.billData;
  
  var notificationData = req.body.notificationData || req.query.notificationData;
  
  var billDataJson = JSON.parse(billData); 
  
  var notificationDataJson = JSON.parse(notificationData);
  
  siteLabour.findOne({ 'siteId': siteId, 'taskId': taskId }, function(err, taskLabour) {
	  if(!err){
		var _labour = {};
		taskLabour.labour.forEach(function(labour){
			if(labour.labourId == labourId && labour.active){
				labour.billing.forEach(function(bill){
					if(bill.billingId == billDataJson.billingId){
						bill.billingAmount = billDataJson.billingAmount;
						bill.invoice = billDataJson.invoice;
						bill.updatedBy = userId;
						bill.updateDate = new Date();						
					}
				});
				_labour = labour;
			} 
		});
		taskLabour.save(function(err, obj){
			emailHandler({
			//Container
				targeted: false,
				targetedTo: '',							
				siteId: siteId,
				notificationKey: notificationDataJson.key,
				subject: notificationDataJson.subject,
				content: notificationDataJson.message,
				toIdList: []
			},{
				//Call Back
				success: function(r){
					logger.log('Email Sent Successfully');
					res.json({ success: true, operation: true, labour: _labour });
				}, failure: function(){
					logger.log('Email Not Sent. But it is still a Successfull Data Entry');
					res.json({ success: true , operation: true, labour: _labour });
				}
			});
		});
	  }
	  else res.json({ success: true , operation: false});
  });
});

router.post('/approvelabourbill', function(req, res) {
  var userId = req.body.userId || req.query.userId;	
  var siteId = req.body.siteId || req.query.siteId;	
  var taskId = req.body.taskId || req.query.taskId;
  var labourId = req.body.labourId || req.query.labourId;
  
  var billId = req.body.billId || req.query.billId;
  
  var notificationData = req.body.notificationData || req.query.notificationData;
  
  var notificationDataJson = JSON.parse(notificationData);
  
  siteLabour.findOne({ 'siteId': siteId, 'taskId': taskId }, function(err, taskLabour) {
	  if(!err){
		var _labour = {};
		var mailToUser = '';
		taskLabour.labour.forEach(function(labour){
			if(labour.labourId == labourId && labour.active){
				labour.billing.forEach(function(bill){
					if(bill.billingId == billId && !bill.approved){
						bill.approved = true;
						bill.approvedBy = userId;
						bill.approvalDate = new Date();
						mailToUser = bill.createdBy;
						//Total Bill
						labour.totalBill = eval(labour.totalBill) + eval(bill.billingAmount);
					}
				});
				_labour = labour;
			} 
		});
		taskLabour.save(function(err, obj){
			emailHandler({
			//Container
				targeted: true,
				targetedTo: mailToUser,							
				siteId: siteId,
				notificationKey: notificationDataJson.key,
				subject: notificationDataJson.subject,
				content: notificationDataJson.message,
				toIdList: []
			},{
				//Call Back
				success: function(r){
					logger.log('Email Sent Successfully');
					res.json({ success: true, operation: true, labour: _labour });
				}, failure: function(){
					logger.log('Email Not Sent. But it is still a Successfull Data Entry');
					res.json({ success: true , operation: true, labour: _labour });
				}
			});
		});
	  }
	  else res.json({ success: true , operation: false});
  });
});

router.post('/paylabourbill', function(req, res) {
  var userId = req.body.userId || req.query.userId;	
  var siteId = req.body.siteId || req.query.siteId;	
  var taskId = req.body.taskId || req.query.taskId;
  var labourId = req.body.labourId || req.query.labourId;
  var billId = req.body.billId || req.query.billId;
  
  var paymentData = req.body.paymentData || req.query.paymentData;
  
  var notificationData = req.body.notificationData || req.query.notificationData;
  
  var paymentDataJson = JSON.parse(paymentData); 
  
  var notificationDataJson = JSON.parse(notificationData);
  
  siteLabour.findOne({ 'siteId': siteId, 'taskId': taskId }, function(err, taskLabour) {
	  if(!err){
		var _labour = {};
		taskLabour.labour.forEach(function(labour){
			if(labour.labourId == labourId){
				labour.billing.forEach(function(bill){
					if(bill.billingId == billId){
						let totalPayment = 0;
						bill.payments.forEach(function(payment){
							totalPayment = eval(payment.payment);
						});
						
						let balance = eval(bill.billingAmount) - eval(totalPayment);
						if(eval(paymentDataJson.paidAmount) > balance){
							return res.json({ success: true, operation: true, labour: labour, dispute: true});
						} else {
							bill.payments.push({
								paymentId: paymentDataJson.paymentId,
								payment: paymentDataJson.paidAmount,
								paidBy: userId,
								paymentDate: new Date()	
							});
							bill.totalPayment = eval(bill.totalPayment) + eval(paymentDataJson.paidAmount);
							labour.totalPayment = eval(labour.totalPayment) + eval(paymentDataJson.paidAmount);
						}
					}
				});
				_labour = labour;
			} 
		});
		taskLabour.save(function(err, obj){
			emailHandler({
			//Container
				targeted: false,
				targetedTo: '',								
				siteId: siteId,
				notificationKey: notificationDataJson.key,
				subject: notificationDataJson.subject,
				content: notificationDataJson.message,
				toIdList: []
			},{
				//Call Back
				success: function(r){
					logger.log('Email Sent Successfully');
					res.json({ success: true, operation: true, labour: _labour, dispute: false });
				}, failure: function(){
					logger.log('Email Not Sent. But it is still a Successfull Data Entry');
					res.json({ success: true , operation: true, labour: _labour, dispute: false });
				}
			});
		});
	  }
	  else res.json({ success: true , operation: false});
  });
});

router.post('/consumesiteinventory', function(req, res) {
  var userId = req.body.userId || req.query.userId;	
  var siteId = req.body.siteId || req.query.siteId;	
  var taskId = req.body.taskId || req.query.taskId;	
  var consumptionData = req.body.consumptionData || req.query.consumptionData;
  var consumptionDataJson = JSON.parse(consumptionData);

  siteInventory.findOne({ 'siteId': siteId, 'taskId': taskId }, function(err, taskInventory) {
	  if(err) res.json({ success: true , operation: false});
	  else {
		  cnstrntSite.findOne({ 'siteId': siteId, 'active': true }, function(err1, siteData) {
			  if(err1) res.json({ success: true , operation: false});
			  else {
				let _item = {};
				let _m = 'Consumption Information Saved';
				let reject = false;
				siteData.taskList.forEach(function(task){
					if(task.taskId == taskId && task.taskStatus != 'Running'){
						reject = true;
						_m = 'Task is not Running. Please refresh to see actual Task status.';
					}
				});
				if(reject) res.json({ success: true , operation: true, item: _item, message: _m});
				else {
					reject = false;
					taskInventory.inventory.forEach(function(item){
						if(item.item == consumptionDataJson.item){
							if(Number(item.quantity) >= Number(consumptionDataJson.quantity)){
								consumptionDataJson.consumedBy = userId;
								consumptionDataJson.consumedDate = new Date();
								item.consumption.push(consumptionDataJson);
								item.quantity = Number(item.quantity) - Number(consumptionDataJson.quantity);
								_item = item;
							} else {
								_item = item;
								reject = true;
								_m = 'Invalid Consumption Quantity. Please refresh to see actual Inventory status.';
							}
						}
					});
					if(!reject)
						taskInventory.save(function(err2, obj){
							if(!err2)
								res.json({ success: true , operation: true, item: _item, message: _m});
							else {
								console.log(err2);
								res.json({ success: true , operation: false});
							}
						});
					else res.json({ success: true , operation: true, item: _item, message: _m});
				}
			  }
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



