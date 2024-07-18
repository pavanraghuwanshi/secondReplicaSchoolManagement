const express = require("express");
const router = express.Router();
const Child = require('../models/child');
const RequestOfChild  = require('../models/requestType');
const jwtAuthMiddleware = require('../jwt')

    
router.post('/request-of-child', jwtAuthMiddleware, async (req, res) => {
    try {
    const { childId, startDate, endDate, reason } = req.body;
    const parentId = req.user.id;

    // Validate that the child belongs to the parent
    const child = await Child.findOne({ _id: childId, parentId });
    if (!child) {
        return res.status(400).json({ error: 'Invalid child ID' });
    }

    const newRequest = new RequestOfChild({
        childId,
        startDate,
        endDate,
        reason
    });

    await newRequest.save();
    res.status(201).json({ request: newRequest });
    } catch (error) {
    console.error('Error creating request:', error);
    res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/request-history/:childId', jwtAuthMiddleware, async (req, res) => {
    try {
    const { childId } = req.params;
    const parentId = req.user.id;

    // Validate that the child belongs to the parent
    const child = await Child.findOne({ _id: childId, parentId });
    if (!child) {
        return res.status(400).json({ error: 'Invalid child ID' });
    }

    const requestHistory = await RequestOfChild.find({ childId });
    res.status(200).json({ requestHistory });
    } catch (error) {
    console.error('Error fetching request history:', error);
    res.status(500).json({ error: 'Internal server error' });
    }
});
    