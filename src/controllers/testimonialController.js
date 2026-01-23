const { Testimonial, User } = require('../models');
const { ValidationError, NotFoundError } = require('../middleware/errorHandler');

// List testimonials with pagination
exports.list = async (req, res, next) => {
  try {
    const { all, page = 1, limit = 3 } = req.query;
    const showAll = all === 'true';

    // Build where clause
    const whereClause = showAll ? {} : { is_active: true };

    if (showAll) {
      // Return all without pagination
      const testimonials = await Testimonial.findAll({
        where: whereClause,
        order: [['created_at', 'DESC']]
      });
      return res.json(testimonials);
    }

    // Paginated response
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const { count, rows } = await Testimonial.findAndCountAll({
      where: whereClause,
      limit: limitNum,
      offset: offset,
      order: [['created_at', 'DESC']]
    });

    // Calculate pagination info
    const totalPages = Math.ceil(count / limitNum);
    const hasNext = pageNum < totalPages;
    const hasPrevious = pageNum > 1;

    res.json({
      count: count,
      next: hasNext ? `?page=${pageNum + 1}&limit=${limitNum}` : null,
      previous: hasPrevious ? `?page=${pageNum - 1}&limit=${limitNum}` : null,
      results: rows
    });
  } catch (error) {
    next(error);
  }
};

// Get single testimonial
exports.get = async (req, res, next) => {
  try {
    const { id } = req.params;

    const testimonial = await Testimonial.findByPk(id);

    if (!testimonial) {
      throw new NotFoundError('Testimonial not found');
    }

    res.json(testimonial);
  } catch (error) {
    next(error);
  }
};

// Create testimonial
exports.create = async (req, res, next) => {
  try {
    const {
      user_id,
      name,
      designation = '',
      content,
      image = null,
      is_anonymous = false,
      is_active = true
    } = req.body;

    // Validate required fields
    if (!name || !content) {
      throw new ValidationError('Name and content are required');
    }

    // Verify user exists if user_id provided
    if (user_id) {
      const user = await User.findByPk(user_id);
      if (!user) {
        throw new ValidationError('User not found');
      }
    }

    const testimonial = await Testimonial.create({
      user_id: user_id || null,
      name,
      designation,
      content,
      image,
      is_anonymous,
      is_active
    });

    res.status(201).json(testimonial);
  } catch (error) {
    next(error);
  }
};

// Update testimonial
exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const testimonial = await Testimonial.findByPk(id);

    if (!testimonial) {
      throw new NotFoundError('Testimonial not found');
    }

    // Verify user exists if user_id is being updated
    if (updateData.user_id) {
      const user = await User.findByPk(updateData.user_id);
      if (!user) {
        throw new ValidationError('User not found');
      }
    }

    await testimonial.update(updateData);

    res.json(testimonial);
  } catch (error) {
    next(error);
  }
};

// Delete testimonial
exports.delete = async (req, res, next) => {
  try {
    const { id } = req.params;

    const testimonial = await Testimonial.findByPk(id);

    if (!testimonial) {
      throw new NotFoundError('Testimonial not found');
    }

    await testimonial.destroy();

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

module.exports = exports;
