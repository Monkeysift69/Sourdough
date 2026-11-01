const pool = require('../db');

// Log details on the server; send only a generic message to the client.
function fail(res, err) {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again later.' });
}

exports.list = async (req, res) => {

}

exports.restock = async (req, res) => {

}
