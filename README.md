#  Django/webpack integration

## Overview

A typical Django "project" is composed of a number of "applications" each with their `templates` and `static` subfolders, to name only those that will be relevant to integrate Django and Webpack in a possibly decent way

```
MyDjangoProject/
├── MyDjangoProject/
├── MyFirstApp
│     ├── static
│     └── templates
└── MySecondApp
    ├── static
    └── templates
```

If ours is a legacy project, we'll have a number of templates under each application's template folder, with a directory structure like:

```
Appname/
└── templates
    ├── Appname
    │   ├── somepage.html
    │   └── index.html
    └── anotherApp
        └── overriddentemplate.html
```

The App's static folder instead contains any "pure JS" code written for our application (meaning, handcrafted JS code that isn't processed by Django as a template nor transpiled or bundled unless you do it manually, like running riot-compiler on a bunch of tags) together with our static assets and maybe some 10 years old Javascript library that our project needs to use:

```
Appname/
└── static
    ├── js
    │   ├── appname.js
    │   └── c3-v3.2.1.js
    ├── img
    │   └── logo.png
    └── css
        └── base.css
```

The important observation made by Pascal Widdershoven [here](https://pascalw.me/blog/2020/04/19/webpack-django.html) is that Django will:

1. serve all content from `/static/` folders during development
2. collect, pack, "[manifestize](https://docs.djangoproject.com/en/3.1/ref/contrib/staticfiles/#manifeststaticfilesstorage)" and eventually upload somewhere all that same content when we run `./manage.py collectstatics`

The general idea is that, if we can tell Webpack to store its output in a `/static/` directory, either an existing one or one we add for its private use, then we'll be able to access those files directly from Django without needing any additional tool or integration: Webpack's dev server will output its temporary JS in those folders and the final output of a `build` will also be there, waiting for a `collectstatic` to deploy it where it needs to be.

## New project structure

The idea behind the integration is to extend an old Django application by "merging" on top of it a Vue 3 application created with `vue-cli` . We can get our Django `project_folder` and run a `vue create project_folder` to have Vue-cli add all the required structure to use Vue, its plugins, Webpack and the rest of the  merry madness that comes with it.

```mkdir app_one/frontend
# the most common case is you want to add Vue to an existing Django project, but if not...
django-manage startproject integrating_vue
vue create integrating_vue
# choose merge then Vue 3
cd integrating_vue
# create our Django apps
./manage.py startapp app_one
./manage.py startapp app_two
# create useful directories
mkdir integrating_vue/templates
mkdir -p app_one/templates/app_one
mkdir -p app_two/templates/app_two
mkdir app_one/frontend app_one/assets app_ome/components
mkdir app_two/frontend app_two/assets app_two/components
rm -r src public
# or copy files from src/assets, src/components and public/index.html to your applications as starting point
```

## `vue.config.js` file for Django integration

To make this work we need to tell Vue-cli quite a bit of things about where are our files and where we want to put the result of all the packing and bundling

```javascript
// vue.config.js

module.exports = {
    // we need one Vue 'page' for each Django application we want to use Vue with
    // of course if it's an option to have a separate frontend or an SPA we'll only create one
    pages: {
        app_one: {
            // entry point for the app's page
            entry: 'app_one/frontend/one_main.js',
            // the source EJS template (can contain Django template code)
            template: 'app_one/frontend/one_index.html',
            // the output template needs to be in this app's templates directory
            // these compiled templates should not be included in git
            filename: '../app_one/templates/app_one/index.html',
            // when using title option,
            // template title tag needs to be <title><%= htmlWebpackPlugin.options.title %></title>
            title: 'App One Index Page',
            // chunks to include on this page, by default includes
            // extracted common chunks and vendor chunks.
            chunks: ['chunk-vendors', 'chunk-common', 'index']
        },
        app_two: {
            entry: 'app_two/frontend/two_main.js',
            template: 'app_two/frontend/two_index.html',
            filename: '../app_two/templates/app_two/index.html',
            title: 'App Two Index Page',
            chunks: ['chunk-vendors', 'chunk-common', 'index']
        },
    },
    devServer: {
        port: 8081,   // any unused port is fine
    	  // this is the main change that allow this strategy: create files that will be served by Django
        writeToDisk: true,
        // useful to see compilation warning/errors in the browser
        overlay: {
            warnings: true,
            errors: true
        },
    },
    // we want to use html-webpack-plugin to inject the required CSS and JS files in our templates
    // this requires "a bit" of setup: each page/app has a dedicated instance of the plugin and we need
    // to change its configuration to avoid automatic injection (wouldn't work in a partial template) and
    // to include the app's JS bundle in the htmlWebpackPlugin.files objects
    chainWebpack: config => {
        config
            .plugin('html-app_one')
            .tap(args => {
                args[0].inject = false
                args[0].chunks.push('app_one')
                return args
            })
        config
            .plugin('html-app_two')
            .tap(args => {
                args[0].inject = false
                args[0].chunks.push('app_two')
                return args
            });
    },
    // output files to <django project>/dist/static
    // this directory shouldn't be committed to git (will be rebuilt on deployment)
    // you also need to add this directory to STATICFILES_DIR in settings.py, for example:
	  /***
  		  STATICFILES_DIRS = (
      		  BASE_DIR / 'dist' / 'static',   # Vue assets static dir
    		)
    ***/
    outputDir: './dist',
    assetsDir: "static",
}

```

This will create a `integrating_vue/dist/static` folder where Webpack will store all the artifacts produced during `serve` or `build`.
In addition to that we'll have, for each Django app, pre-processed templates files stored in the corresponding `app_xxx/templates/app_xxx/` directory. The templates will need to include all the CSS and JS files produced by Webpack.

## How to inject CSS and JS bundles in a HTML template file 

The template will be valid for both Webpack HTML generation (EJS) and Django (Django template language or Jinja). To have more control about where and how our CSS and JS bundles are injected, we disabled automatic injection of those files above (controlled bt html-webpack-plugin, named "html" by Vue-cli) and we have EJS code to re-add them in the template blocks were they're needed, for example:

```jinja2
{% extends "base_site.html" %}
{% load static i18n %}{% get_current_language as LANGUAGE_CODE %}

{% block style %}
{# htmlWebpackPlugin.tags.headTags requires html-weback-plugin 4.0 we have 3.2 #}
{# with 3.2 the "way" is to loop over htmlWebpackPlugin.files.css for CSS #}
<% for (var item in htmlWebpackPlugin.files.css) { %>
    <link href="<%= htmlWebpackPlugin.files.css[item] %>" rel="preload" as="style">
    <link href="<%= htmlWebpackPlugin.files.css[item] %>" rel="stylesheet">
<% } %>
{# we can also loop over JS files here, marking them as preload #}
<% for (var chunk in htmlWebpackPlugin.files.chunks) { %>
    <link href="<%= htmlWebpackPlugin.files.chunks[chunk].entry %>" rel="preload" as="script">
<% } %>
{# include existing styles from the template we're extending #}
{{ block.super }}
{% endblock style %}

{% block extrahead %}
{% endblock extrahead %}

{% block content_header %}
    <div class="row">

        <div class="col-md-6 col-sm-6 col-xs-4">
            <div class="button-holder">
                <input class="fa-search textinput textInput" placeholder="Search..." />
            </div>
        </div>

        <div class="col-md-6 col-sm-6 col-xs-8">
            <div class="button-holder pull-right">
                    <button id="btn-do-something" class="btn btn-ghost btn-orange btn-pill pull-right btn-margin-right" >
                        {% trans 'Do something' %}
                    </button>
            </div>
        </div>
    </div>

{% endblock content_header %}

{% block content_body %}
    <noscript>
      <strong>We're sorry but <%= htmlWebpackPlugin.options.title %> doesn't work properly without JavaScript enabled. Please enable it to continue.</strong>
    </noscript>
    <p>Some text from the base template? Doesn't get autoreloaded of course...</p>
    <p>Are we a user? {{ user }}</p>
    <p>Is user staff? {{ user.is_staff }}</p>
    <p>Is user a superuser? {{ user.is_superuser }}</p>
    {# we can then use a Vue app tag, the relevant (bundled) code is loaded at the end of the file #}
    <div id="app"></div>
{% endblock content_body %}

{% block extrascript %}
{# htmlWebpackPlugin.tags.bodyTags requires html-weback-plugin 4.0 we have 3.2 #}
{# with 3.2 the "way" is to loop over htmlWebpackPlugin.files.chunks for JS #}
<% for (var chunk in htmlWebpackPlugin.files.chunks) { %>
<script src="<%= htmlWebpackPlugin.files.chunks[chunk].entry %>"></script>
<% } %>
{% endblock extrascript %}
```

Keep in mind that there will be no CSS files from your application when running in dev mode (apparently due to some bug) and so the top <link> tags will be filled only when running with code produced from `npm run build`

in case you need some debugging of what (and when... development != production) exactly is available from htmlWebpackPlugin you can add this code fragment somewhere in our source template files:

```html
<hr />
<p>files object</p>
<ul>
    <% for (var obj in htmlWebpackPlugin.files) { %>
    <li>
        <%= obj %> (<%= typeof(htmlWebpackPlugin.files[obj]) %>): <%= htmlWebpackPlugin.files[obj] %>
    </li>
    <% } %>
</ul>
<hr />
<p>chunks object</p>
<ul>
    <% for (var obj in htmlWebpackPlugin.files.chunks) { %>
    <li>
        <%= obj %> (<%= typeof(htmlWebpackPlugin.files.chunks[obj]) %>): <%= htmlWebpackPlugin.files.chunks[obj] %>
    </li>
    <% } %>
</ul>
<hr />
<p>css object</p>
<ul>
    <% for (var obj in htmlWebpackPlugin.files.css) { %>
    <li>
        <%= obj %> (<%= typeof(htmlWebpackPlugin.files.css[obj]) %>): <%= htmlWebpackPlugin.files.css[obj] %>
    </li>
    <% } %>
</ul>
<hr />
<p>js object</p>
<ul>
    <% for (var obj in htmlWebpackPlugin.files.js) { %>
    <li>
        <%= obj %> (<%= typeof(htmlWebpackPlugin.files.js[obj]) %>): <%= htmlWebpackPlugin.files.js[obj] %>
    </li>
    <% } %>
</ul>
<hr />
```



