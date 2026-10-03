const router=require('express').Router();
const {requireAuth}=require('../../middleware/auth.middleware');
const c=require('./branch.controller');
router.post('/switch',requireAuth,c.switchBranch);
module.exports=router;
