const express =  require('express');
const router = express.Router()


const {createGroup, getGroup, deleteGroup} = require('../controllers/groupController');

const authMiddleware = require('../middleware/authMiddleware');

router.post('/',authMiddleware,createGroup);
router.get('/', getGroup);
router.delete('/:id', authMiddleware, deleteGroup)


module.exports = router;
