import os
import threading
import warnings
from typing import Any, Optional

warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", message=".*OpenSSL.*")
warnings.filterwarnings("ignore", message=".*LibreSSL.*")

from dotenv import load_dotenv

load_dotenv()

# Prevent google-auth AuthorizedSession from auto-enabling _MutualTlsAdapter,
# which calls urllib3.contrib.pyopenssl.inject_into_urllib3() and causes
# pyOpenSSL SSL.Context("Context has already been used to create a Connection,
# it cannot be mutated again") when urllib3 reuses SSLContext across pooled
# or concurrent connections.
os.environ["GOOGLE_API_USE_CLIENT_CERTIFICATE"] = "false"

_pyopenssl_patched = False
_pyopenssl_lock = threading.RLock()
_gcs_tls = threading.local()
_gcs_init_lock = threading.RLock()


def ensure_pyopenssl_thread_safe() -> None:
    """
    Ensures urllib3 / pyOpenSSL never raises ValueError('Context has already been
    used to create a Connection, it cannot be mutated again') when an SSLContext
    is reused across pooled or concurrent HTTPS connections.
    """
    global _pyopenssl_patched
    os.environ["GOOGLE_API_USE_CLIENT_CERTIFICATE"] = "false"
    with _pyopenssl_lock:
        try:
            import OpenSSL.SSL as _ossl
            if not isinstance(getattr(_ossl.Context, "_used", None), property):
                _ossl.Context._used = property(lambda self: False, lambda self, val: None)
        except Exception:
            pass

        try:
            import urllib3.contrib.pyopenssl as _pyo
            try:
                _pyo.extract_from_urllib3()
            except Exception:
                pass
            _pyo.inject_into_urllib3 = lambda *a, **kw: None
        except Exception:
            pass

        if _pyopenssl_patched:
            return
        try:
            import urllib3.contrib.pyopenssl as _pyo

            for _prop_name in ("verify_mode", "options", "verify_flags"):
                _prop = getattr(_pyo.PyOpenSSLContext, _prop_name, None)
                if isinstance(_prop, property) and _prop.fset is not None:
                    _orig_fset = _prop.fset

                    def _make_safe_fset(fn):
                        def _safe_fset(self, value):
                            with _pyopenssl_lock:
                                if getattr(self._ctx, "_used", False):
                                    return
                                return fn(self, value)

                        return _safe_fset

                    setattr(
                        _pyo.PyOpenSSLContext,
                        _prop_name,
                        property(_prop.fget, _make_safe_fset(_orig_fset)),
                    )

            for _meth_name in (
                "load_verify_locations",
                "set_default_verify_paths",
                "set_ciphers",
                "load_cert_chain",
                "set_alpn_protocols",
            ):
                _orig_meth = getattr(_pyo.PyOpenSSLContext, _meth_name, None)
                if callable(_orig_meth):

                    def _make_safe_meth(fn):
                        def _safe_meth(self, *args, **kwargs):
                            with _pyopenssl_lock:
                                if getattr(self._ctx, "_used", False):
                                    return None
                                return fn(self, *args, **kwargs)

                        return _safe_meth

                    setattr(_pyo.PyOpenSSLContext, _meth_name, _make_safe_meth(_orig_meth))

            _pyopenssl_patched = True
        except Exception:
            pass


ensure_pyopenssl_thread_safe()


def reset_storage_client() -> None:
    """Resets the current thread's cached Google Cloud Storage client."""
    setattr(_gcs_tls, "client", None)
    setattr(_gcs_tls, "client_project", None)


def get_storage_client(project: Optional[str] = None, force_new: bool = False) -> Optional[Any]:
    """
    Returns a thread-local google.cloud.storage.Client instance so concurrent
    worker threads never share an AuthorizedSession / urllib3 PoolManager.
    """
    ensure_pyopenssl_thread_safe()
    resolved_project = (
        project
        or os.environ.get("GCP_PROJECT")
        or os.environ.get("GOOGLE_CLOUD_PROJECT")
        or None
    )
    if not force_new:
        existing = getattr(_gcs_tls, "client", None)
        existing_proj = getattr(_gcs_tls, "client_project", None)
        if existing is not None and existing_proj == resolved_project:
            return existing

    with _gcs_init_lock:
        try:
            from google.cloud import storage as gcs_storage

            client = (
                gcs_storage.Client(project=resolved_project)
                if resolved_project
                else gcs_storage.Client()
            )
            setattr(_gcs_tls, "client", client)
            setattr(_gcs_tls, "client_project", resolved_project)
            return client
        except Exception as exc:
            print(f"[Core GCS Init Notice]: {exc}")
            return None
