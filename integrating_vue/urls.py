"""integrating_vue URL Configuration

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/3.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.conf import settings
from django.contrib import admin
from django.urls import path, re_path

from app_one import views as appone_views
from app_two import views as apptwo_views


urlpatterns = [
    path('admin/', admin.site.urls),

    path('', appone_views.index, name="root_one_index"),
    path('appone/', appone_views.index, name="one_index"),

    path('apptwo/', apptwo_views.index, name="two_index"),
]

# In developement, proxy hot update requests to webpack-dev-server since they can't
if settings.DEBUG:
    try:
        from revproxy.views import ProxyView
    except ImportError:
        pass
    else:
        from revproxy import utils
        # responses bigger than MIN_STREAMING_LENGTH are streamed, breaking Webpack dev server
        # We monkey patch it to a big enough value, here 256MB
        utils.MIN_STREAMING_LENGTH = 256 * 1024 * 1024  # noqa
        urlpatterns += [
            re_path(r'(?P<path>.*\.hot-update\..*)$',
                    ProxyView.as_view(upstream=settings.WEBPACK_DEVSERVER_URL),
                    name='hotreload_proxy'),
        ]
