const router=require('express').Router();const {requireAuth}=require('../../middleware/auth.middleware');const {requireBranch}=require('../../middleware/branch.middleware');const {requirePermission}=require('../../middleware/permission.middleware');const c=require('./inventory.controller');
router.use(requireAuth,requireBranch);
router.get('/',requirePermission('inventory.view'),c.index);
router.get('/api/expiring',requirePermission('inventory.view'),c.expiring);
router.post('/adjustments',requirePermission('inventory.adjust'),c.adjust);
router.post('/batches/:id/status',requirePermission('inventory.batch_status'),c.status);
module.exports=router;