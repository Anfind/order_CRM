const { getAllOrders, getStats } = require('./server/database.js');
console.log(getAllOrders().length);
console.log(getStats());
