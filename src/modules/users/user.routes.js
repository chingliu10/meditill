const router=require('express').Router();
const {requireAuth}=require('../../middleware/auth.middleware');
const {requirePermission}=require('../../middleware/permission.middleware');
const c=require('./user.controller');

router.use(requireAuth,requirePermission('users.manage'));

router.get('/',c.index);
router.get('/:id/edit',c.editForm);
router.post('/',c.create);
router.post('/:id',c.update);
router.post('/:id/active',c.active);

module.exports=router;
