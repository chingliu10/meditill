const router=require('express').Router();
const {requireAuth}=require('../../middleware/auth.middleware');
const {requireBranch}=require('../../middleware/branch.middleware');
const c=require('./dashboard.controller');
router.get('/',requireAuth,requireBranch,c.index);
module.exports=router;
