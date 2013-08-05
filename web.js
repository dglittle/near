
function defaultEnv(key, val) {
    if (!process.env[key])
        process.env[key] = val
}
defaultEnv("PORT", 5000)
defaultEnv("HOST", "http://localhost:" + process.env.PORT)
defaultEnv("NODE_ENV", "production")
defaultEnv("MONGOHQ_URL", "mongodb://localhost:27017/near")
defaultEnv("SESSION_SECRET", "super_secret")

///

process.on('uncaughtException', function (err) {
    try {
		console.log(err)
        console.log(err.stack)
	} catch (e) {}
})

///

var _ = require('gl519')
_.run(function () {

    var db = require('mongojs').connect(process.env.MONGOHQ_URL)

    var express = require('express')
    var app = express()
    
    _.serveOnExpress(express, app)

    app.use(express.cookieParser())
    app.use(function (req, res, next) {
        _.run(function () {
            req.body = _.consume(req)
            next()
        })
    })

    var MongoStore = require('connect-mongo')(express)
    app.use(express.session({
        secret : process.env.SESSION_SECRET,
        cookie : { maxAge : 10 * 365 * 24 * 60 * 60 * 1000 },
        store : new MongoStore({
            url : process.env.MONGOHQ_URL,
            auto_reconnect : true,
            clear_interval : 3600
        })
    }))

    var g_rpc_version = 1

    var rpc = {}
    app.all(/\/rpc\/([^\/]+)\/([^\/]+)/, function (req, res, next) {
        _.run(function () {
            try {
                if (g_rpc_version != req.params[0])
                    throw new Error('version mismatch')
                if (!req.cookies.rpc_token || req.cookies.rpc_token != req.params[1])
                    throw new Error('token mismatch')
                var input = _.unJson(req.method.match(/post/i) ? req.body : _.unescapeUrl(req.url.match(/\?(.*)/)[1]))
                function runFunc(input) {
                    return rpc[input.func].apply(null, [input.arg, req, res])
                }
                if (input instanceof Array)
                    var output = _.map(input, runFunc)
                else
                    var output = runFunc(input)
                var body = _.json(output) || "null"
                res.writeHead(200, {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Content-Length': Buffer.byteLength(body)
                })
                res.end(body)
            } catch (e) {
                next(e)
            }
        })
    })

    ///

    try {
        _.p(db.collection('points').insert({ _id : 'points' }, _.p()))
    } catch (e) {}

    var h = 30

    function randomIndex(n) {
        return Math.floor(Math.random() * n)
    }

    function isValidPoint(p) {
        if (p.x < 0 || p.y < 0 || p.x > 400 || p.y > 400) return false
            
        if ((p.x - 5) % 10 != 0) return false
        if ((p.y - 5) % 10 != 0) return false
            
        return p.x < 400 / 3 || p.x > 400*2/3 || p.y < 200 - (h / 2) || p.y > 200 + (h / 2)
    }

    function randomPoint() {
        while (true) {
            var p = {
                x : randomIndex(400 / 10) * 10 + 5,
                y : randomIndex(400 / 10) * 10 + 5
            }
            if (isValidPoint(p)) break
        }
        return p
    }

    function setPoint(points, x, y, yes) {
        var p = { x : x, y : y }
        if (!isValidPoint(p)) throw new Error("bad point")
        var key = '' + x + ',' + y
        var o = points[key]
        if (!o) {
            p.yesses = 0
            p.noes = 0
            o = points[key] = p
            _.p(db.collection('points').update({ _id : 'points'}, { $set : _.object([[key, p]]) }, _.p()))
        }
        if (yes) {
            o.yesses++
            _.p(db.collection('points').update({ _id : 'points'}, { $inc : _.object([[key + '.yesses', 1]]) }, _.p()))
        } else {
            o.noes++
            _.p(db.collection('points').update({ _id : 'points'}, { $inc : _.object([[key + '.noes', 1]]) }, _.p()))
        }
    }

    function getPoints() {
        var points = _.p(db.collection('points').findOne({ _id : 'points' }, _.p()))
        delete points._id
        return points
    }

    ///

    rpc.setPoint = function (arg, req, res) {
        var points = getPoints()
        setPoint(points, arg.x, arg.y, arg.yes)
        req.session.setPoint = true
        return points
    }

    var indexHtml = _.read('./index.html')
    app.get('/', function (req, res) {
        _.run(function () {
            res.cookie('rpc_version', g_rpc_version, { httpOnly: false})
            res.cookie('rpc_token', _.randomString(10), { httpOnly: false})

            var data = {}
            if (req.session.setPoint) {
                data = { points : getPoints() }
            } else {
                if (!req.session.randomPoint) {
                    req.session.randomPoint = randomPoint()
                }
                data = { randomPoint : req.session.randomPoint }
            }
            s = indexHtml.replace(/@@@data@@@/g, _.json(data))
            res.send(s)
        })
    })

    app.use(express.errorHandler({
        dumpExceptions: true,
        showStack: true
    }))

    app.listen(process.env.PORT, function() {
        console.log("go to " + process.env.HOST)
    })

})
