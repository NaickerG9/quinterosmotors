from flask import Blueprint, abort, redirect, render_template, url_for
from flask_login import current_user, login_required

bp = Blueprint("pages", __name__)


@bp.get("/login")
def login():
    if current_user.is_authenticated:
        return redirect(url_for("pages.dashboard"))
    return render_template("login.html")


@bp.get("/")
@login_required
def dashboard():
    return render_template("dashboard.html", active_page="dashboard")


@bp.get("/vehiculos")
@login_required
def vehiculos():
    return render_template("vehiculos/lista.html", active_page="vehiculos")


@bp.get("/vehiculos/nuevo")
@login_required
def vehiculo_nuevo():
    return render_template("vehiculos/form.html", active_page="vehiculos")


@bp.get("/vehiculos/<int:vehiculo_id>")
@login_required
def vehiculo_detalle(vehiculo_id):
    return render_template(
        "vehiculos/detalle.html",
        active_page="vehiculos",
        vehiculo_id=vehiculo_id,
    )


@bp.get("/clientes")
@login_required
def clientes():
    return render_template("clientes/lista.html", active_page="clientes")


@bp.get("/clientes/<int:cliente_id>")
@login_required
def cliente_detalle(cliente_id):
    return render_template(
        "clientes/detalle.html",
        active_page="clientes",
        cliente_id=cliente_id,
    )


@bp.get("/ventas")
@login_required
def ventas():
    return render_template("ventas/lista.html", active_page="ventas")


@bp.get("/ventas/nueva")
@login_required
def venta_nueva():
    return render_template("ventas/nueva.html", active_page="ventas")


@bp.get("/ventas/<int:venta_id>")
@login_required
def venta_detalle(venta_id):
    return render_template(
        "ventas/detalle.html",
        active_page="ventas",
        venta_id=venta_id,
    )


@bp.get("/prospectos")
@login_required
def prospectos():
    return render_template("prospectos.html", active_page="prospectos")


@bp.get("/configuracion")
@login_required
def configuracion():
    if current_user.rol != "admin":
        abort(403)
    return render_template("configuracion.html", active_page="configuracion")


@bp.get("/usuarios")
@login_required
def usuarios():
    if current_user.rol != "admin":
        abort(403)
    return render_template("usuarios/lista.html", active_page="usuarios")
