const sequelize = require('../config/database');
const User = require('./User');
const Alim = require('./Alim');
const Istekhara = require('./Istekhara');
const IstekharaQuota = require('./IstekharaQuota');
const Testimonial = require('./Testimonial');
const ContactForm = require('./ContactForm');
const InstagramPost = require('./InstagramPost');
const InstagramPostImage = require('./InstagramPostImage');

// Define relationships
IstekharaQuota.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(IstekharaQuota, { foreignKey: 'user_id' });

Istekhara.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Istekhara.belongsTo(Alim, { foreignKey: 'replied_by_id', as: 'replied_by' });
Istekhara.belongsTo(IstekharaQuota, { foreignKey: 'quota_used_id', as: 'quota_used' });
IstekharaQuota.hasOne(Istekhara, { foreignKey: 'quota_used_id', as: 'istekhara_request' });

Testimonial.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

InstagramPost.hasMany(InstagramPostImage, { foreignKey: 'post_id', as: 'images' });
InstagramPostImage.belongsTo(InstagramPost, { foreignKey: 'post_id' });

module.exports = {
  sequelize,
  User,
  Alim,
  Istekhara,
  IstekharaQuota,
  Testimonial,
  ContactForm,
  InstagramPost,
  InstagramPostImage
};
