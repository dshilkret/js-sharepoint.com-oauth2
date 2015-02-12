# -*- coding: utf-8 -*-
import os
import cherrypy

from urllib   import urlencode
from httplib2 import Http
from Cheetah.Template import Template

current_dir = os.path.dirname(os.path.abspath(__file__))

class Root(object):
  @cherrypy.expose
  def index(self):
    path = os.path.join(current_dir, "template", "index.html")
    template = Template(file=path)
    return template.respond()

  @cherrypy.expose
  def response(self, **kwargs):
    path = os.path.join(current_dir, "template", "response.html")
    template = Template(file=path)
    return template.respond()

  @cherrypy.expose
  def accessToken(self, **kwargs):
    data = {}
    data["client_id"]     = kwargs["client_id"]
    data["client_secret"] = kwargs["client_secret"]
    data["code"]          = kwargs["code"]
    data["grant_type"]    = kwargs["grant_type"]
    data["redirect_uri"]  = kwargs["redirect_uri"]

    url = kwargs["url"]

    h = Http()
    resp, content = h.request(url, "POST", urlencode(data))
    return content

  @cherrypy.expose
  def refreshToken(self, **kwargs):
    data = {}
    data["grant_type"]    = kwargs["grant_type"]
    data["refresh_token"] = kwargs["refresh_token"]
    data["resource"]      = kwargs["resource"]
    data["client_id"]     = kwargs["client_id"]
    data["client_secret"] = kwargs["client_secret"]

    url = kwargs["url"]

    h = Http()
    resp, content = h.request(url, "POST", urlencode(data))
    return content

conf = {'/': { 'tools.staticdir.on': True,
               'tools.staticdir.dir': os.path.join(current_dir, 'static') }}

cherrypy.quickstart(Root(), '/', conf)