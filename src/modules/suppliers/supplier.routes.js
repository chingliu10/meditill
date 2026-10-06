const router=require('express').Router();
const {requireAuth}=require('../../middleware/auth.middleware');
const {requirePermission}=require('../../middleware/permission.middleware');
const c=require('./supplier.controller');

router.use(requireAuth);
router.get('/',requirePermission('supplier.view'),c.index);
router.get('/api/search',requirePermission('supplier.view'),c.searchApi);
router.post('/',requirePermission('supplier.manage'),c.create);
router.post('/:id/archive',requirePermission('supplier.manage'),c.archive);
router.post('/:id/restore',requirePermission('supplier.manage'),c.restore);

module.exports=router;
