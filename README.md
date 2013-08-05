near
====

is the dot near the bar?

commands to set it up on heroku:

```
heroku apps:create near-bar
heroku addons:add mongohq:sandbox

heroku config:set HOST=http://near-bar.herokuapp.com
heroku config:set SESSION_SECRET=change_me

git push heroku master
```
