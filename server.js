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
    var siteDataJson = JSON.parse(siteData); 
	
	cnstrntSite.update({siteId: siteDataJson.siteId}, {
			taskList: siteDataJson.taskList
		},function(err) {
		if (err) {
			res.json({ success: true, operation: false });
		} else {
			logger.log('Site Updated successfully');
			res.json({ success: true , operation: true});			
		}
	});	
});	
	
//Inventory Set Up
router.get('/loaditeminventoryconfig', function(req, res) {
  inventoryConfig.findOne({configId: "ITEM"},function(err, configData) {
	res.json({success: true, data: configData});
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
	
	//Update Inventory Data
	siteInventory.update({siteId: siteDataJson.siteId, taskId: siteDataJson.taskId}, {
			inventory: siteDataJson.inventory
		},function(err) {
		if (err) {
			res.json({ success: true, operation: false });
		} else {
			logger.log('Config Updated successfully');
			res.json({ success: true , operation: true});
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
	
	//Update labour Data
	siteLabour.update({siteId: siteDataJson.siteId, taskId: siteDataJson.taskId}, {
			labour: siteDataJson.labour
		},function(err) {
		if (err) {
			res.json({ success: true, operation: false });
		} else {
			logger.log('Config Updated successfully');
			res.json({ success: true , operation: true});
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



