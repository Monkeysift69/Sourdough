const pool = require('../db');

function fail(res, err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
}

exports.getAll = async (req, res) => {
    try {
        const [rows] = await pool.query('select * from starters');
        res.json(rows);
    } catch (err) {
        fail(res, err);
    }
}

exports.getOne = async (req, res) => {

}

exports.create = async (req, res) => {

}

exports.update = async (req, res) => {

}

exports.remove = async (req, res) => {

}

exports.listFeedings = async (req, res) => {

}

exports.addFeeding = async (req, res) => {

}
