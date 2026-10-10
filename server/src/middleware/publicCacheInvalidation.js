const contentRoutes = /^\/(boards|classes|groups|subjects|chapters|topics|resources|home-content|questions|assessments|news)(?:\/|$)/;

module.exports = invalidate => (req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && contentRoutes.test(req.path) && req.path !== '/home-content/visit') {
        res.on('finish', () => { if (res.statusCode < 400) invalidate(); });
    }
    next();
};
