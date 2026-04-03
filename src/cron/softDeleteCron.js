const cron = require('node-cron');
const { Op } = require('sequelize');
const { User, Istekhara, IstekharaQuota } = require('../models');
const CognitoService = require('../services/cognito');

const cognito = new CognitoService('user');

/**
 * Cron job: Permanently delete soft-deleted users after 30 days.
 * Runs daily at midnight (00:00).
 */
function startSoftDeleteCron() {
  cron.schedule('0 0 * * *', async () => {  // at 00:00
  // cron.schedule('* * * * *', async () => {  // at every minute for testing
    console.log('[CRON] Running soft-delete cleanup job...');

    try {
      // 30 DAYS DELETE TIME-------------------------
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Find all users soft-deleted 30+ days ago
      const usersToDelete = await User.findAll({
        where: {
          soft_delete: true,
          soft_delete_date: {
            [Op.lte]: thirtyDaysAgo
          }
        }
      });

      // 60 DAYS DELETE TIME-------------------------
      // const sixtyDaysAgo = new Date();
      //   sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      //   // Find all users soft-deleted 60+ days ago
      //   const usersToDelete = await User.findAll({
      //     where: {
      //       soft_delete: true,
      //       soft_delete_date: {
      //         [Op.lte]: sixtyDaysAgo
      //       }
      //     }
      //   });

      if (usersToDelete.length === 0) {
        console.log('[CRON] No expired soft-deleted users found.');
        return;
      }

      console.log(`[CRON] Found ${usersToDelete.length} user(s) to permanently delete.`);

      for (const user of usersToDelete) {
        try {
          // 1. Delete from Cognito
          try {
            await cognito.adminDeleteUser(user.email);
          } catch (cognitoError) {
            if (cognitoError.code !== 'UserNotFoundException') {
              console.error(`[CRON] Error deleting ${user.email} from Cognito:`, cognitoError.message);
              continue; // Skip this user, try again next run
            }
            // UserNotFoundException is fine — already gone from Cognito
          }

          // 2. Delete dependent Istekharas (they reference IstekharaQuota via quota_used_id)
          await Istekhara.destroy({ where: { user_id: user.id } });

          // 3. Delete IstekharaQuotas (they reference User)
          await IstekharaQuota.destroy({ where: { user_id: user.id } });

          // 4. Delete the User
          await user.destroy();

          console.log(`[CRON] Permanently deleted user: ${user.email}`);
        } catch (err) {
          console.error(`[CRON] Failed to permanently delete user ${user.email}:`, err.message);
        }
      }

      console.log('[CRON] Soft-delete cleanup job completed.');
    } catch (error) {
      console.error('[CRON] Soft-delete cleanup job failed:', error.message);
    }
  });

  console.log('✓ Soft-delete cleanup cron job scheduled (daily at midnight)');
}

module.exports = startSoftDeleteCron;
