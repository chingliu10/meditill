const router=require('express').Router();
const {requireAuth}=require('../../middleware/auth.middleware');
const {requireBranch}=require('../../middleware/branch.middleware');
const {requirePermission}=require('../../middleware/permission.middleware');
const c=require('./report.controller');

router.use(requireAuth,requireBranch);

router.get(
  '/sales',
  requirePermission('reports.sales'),
  requirePermission('reports.profit'),
  c.sales
);
router.get('/inventory',requirePermission('reports.inventory'),c.inventory);
router.get('/purchases',requirePermission('reports.purchases'),c.purchases);
router.get('/expiry',requirePermission('reports.inventory'),c.expiry);
router.get('/profit-loss',requirePermission('reports.profit'),c.profitLoss);

module.exports=router;
