const router=require('express').Router();
const {requireAuth}=require('../../middleware/auth.middleware');
const {requirePermission}=require('../../middleware/permission.middleware');
const c=require('./customer.controller');
router.use(requireAuth);
router.get('/',requirePermission('customer.view'),c.index);
router.get('/api/search',requirePermission('sale.create'),c.search);
router.post('/',requirePermission('customer.manage'),c.create);
module.exports=router;
