package de.papaerless.app;

import android.view.WindowManager;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Setzt FLAG_SECURE, solange die App-Sperre aktiv ist: Der Inhalt erscheint nicht in der
 * App-Übersicht und lässt sich nicht per Screenshot oder Bildschirmaufnahme abgreifen.
 */
@CapacitorPlugin(name = "AppLock")
public class AppLockPlugin extends Plugin {

    @PluginMethod
    public void setSecure(PluginCall call) {
        final boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        getActivity().runOnUiThread(() -> {
            if (enabled) {
                getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
            } else {
                getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
            }
            call.resolve();
        });
    }
}
