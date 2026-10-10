const express =  require('express');
const router = express.Router()


const {createGroup, getGroup, updateGroup, deleteGroup} = require('../controllers/groupController');

const authMiddleware = require('../middleware/authMiddleware');
const { protectDelete } = require('../middleware/academicIntegrity');

router.post('/',authMiddleware,createGroup);
router.get('/', getGroup);
router.put('/:id', authMiddleware, updateGroup);
router.delete('/:id', authMiddleware, protectDelete('Group'), deleteGroup);


module.exports = router;
