const asyncHandler = require('express-async-handler');

const ensureApproved = asyncHandler(async (req, res, next) => {
  if (!req.owner) {
    res.status(401);
    throw new Error('Not authorized');
  }

  if (req.owner.status !== 'approved') {
    res.status(403);
    throw new Error('Account not approved yet');
  }

  next();
});

module.exports = { ensureApproved };
