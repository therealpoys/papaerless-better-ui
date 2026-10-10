package de.papaerless.app;

import android.content.ContentResolver;
import android.content.Intent;
import android.content.ClipData;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.OpenableColumns;
import android.util.Log;
import android.widget.Toast;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * Nimmt "Teilen mit…" (ACTION_SEND / ACTION_SEND_MULTIPLE) an: kopiert die geteilten Dateien in den
 * App-Cache und gibt sie der Web-App über getSharedFiles() bzw. das Event "sharedFiles" weiter.
 */
@CapacitorPlugin(name = "ShareTarget")
public class ShareTargetPlugin extends Plugin {

    private static final String TAG = "ShareTarget";

    private final List<JSObject> pending = new ArrayList<>();
    private final List<String> errors = new ArrayList<>();

    /** Wird von MainActivity für den Start-Intent und jeden neuen Intent aufgerufen. */
    public void handleIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        List<Uri> uris = new ArrayList<>();
        if (Intent.ACTION_SEND.equals(action)) {
            Uri uri = getParcelableUri(intent);
            if (uri != null) uris.add(uri);
            else addClipUris(intent, uris);
        } else if (Intent.ACTION_SEND_MULTIPLE.equals(action)) {
            ArrayList<Uri> list = Build.VERSION.SDK_INT >= 33
                ? intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri.class)
                : intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
            if (list != null) uris.addAll(list);
            if (uris.isEmpty()) addClipUris(intent, uris);
        } else {
            return;
        }
        Log.i(TAG, "Teilen empfangen: action=" + action + " type=" + intent.getType() + " uris=" + uris.size());
        // Den Intent entwerten, damit ein Neustart der Activity die Dateien nicht erneut einliest.
        intent.setAction(Intent.ACTION_MAIN);

        if (uris.isEmpty()) {
            synchronized (pending) {
                errors.add("Die App hat keine Datei vom Teilen-Menü erhalten.");
            }
        }
        for (Uri uri : uris) {
            try {
                JSObject file = copyToCache(uri);
                synchronized (pending) {
                    pending.add(file);
                }
            } catch (Exception e) {
                synchronized (pending) {
                    errors.add(e.getClass().getSimpleName() + ": " + e.getMessage());
                }
            }
        }
        int ok;
        int failed;
        synchronized (pending) {
            ok = pending.size();
            failed = errors.size();
        }
        Log.i(TAG, "Teilen verarbeitet: ok=" + ok + " fehler=" + failed);
        if (failed > 0) toast("Teilen fehlgeschlagen: " + errors.get(0));
        notifyListeners("sharedFiles", new JSObject(), true);
    }

    /** Kurze Einblendung aus der Web-App (zeigt, dass geteilte Dateien dort angekommen sind). */
    @PluginMethod
    public void notify(PluginCall call) {
        toast(call.getString("message", ""));
        call.resolve();
    }

    private void toast(String message) {
        if (getActivity() == null || message == null || message.isEmpty()) return;
        getActivity().runOnUiThread(() -> Toast.makeText(getContext(), message, Toast.LENGTH_LONG).show());
    }

    private void addClipUris(Intent intent, List<Uri> uris) {
        ClipData clip = intent.getClipData();
        if (clip == null) return;
        for (int i = 0; i < clip.getItemCount(); i++) {
            Uri uri = clip.getItemAt(i).getUri();
            if (uri != null) uris.add(uri);
        }
    }

    @PluginMethod
    public void getSharedFiles(PluginCall call) {
        JSArray files = new JSArray();
        JSArray errs = new JSArray();
        synchronized (pending) {
            for (JSObject f : pending) files.put(f);
            for (String e : errors) errs.put(e);
            pending.clear();
            errors.clear();
        }
        JSObject result = new JSObject();
        result.put("files", files);
        result.put("errors", errs);
        call.resolve(result);
    }

    private Uri getParcelableUri(Intent intent) {
        return Build.VERSION.SDK_INT >= 33
            ? intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri.class)
            : intent.getParcelableExtra(Intent.EXTRA_STREAM);
    }

    private JSObject copyToCache(Uri uri) throws Exception {
        ContentResolver resolver = getContext().getContentResolver();
        String name = queryName(resolver, uri);
        String type = resolver.getType(uri);
        File dir = new File(getContext().getCacheDir(), "shared");
        if (!dir.exists() && !dir.mkdirs()) throw new Exception("Cache-Ordner nicht anlegbar");
        // Eigenes Unterverzeichnis je Datei, damit gleiche Namen sich nicht überschreiben.
        File sub = new File(dir, String.valueOf(System.nanoTime()));
        if (!sub.mkdirs()) throw new Exception("Cache-Unterordner nicht anlegbar");
        // Auf der Platte ein einfacher Name (die WebView lädt die Datei per URL, Sonderzeichen würden stören);
        // der echte Name geht separat an die Web-App.
        File target = new File(sub, "datei" + safeExtension(name));
        try (InputStream in = resolver.openInputStream(uri);
             OutputStream out = new FileOutputStream(target)) {
            if (in == null) throw new Exception("Datei nicht lesbar (" + uri + ")");
            byte[] buf = new byte[64 * 1024];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        }
        JSObject file = new JSObject();
        file.put("path", target.getAbsolutePath());
        file.put("name", name);
        file.put("type", type == null ? "" : type);
        return file;
    }

    private String safeExtension(String name) {
        int dot = name.lastIndexOf('.');
        if (dot < 0 || name.length() - dot > 8) return "";
        String ext = name.substring(dot).replaceAll("[^A-Za-z0-9.]", "");
        return ext.length() > 1 ? ext : "";
    }

    private String queryName(ContentResolver resolver, Uri uri) {
        String name = null;
        try (Cursor c = resolver.query(uri, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
            if (c != null && c.moveToFirst()) name = c.getString(0);
        } catch (Exception ignored) {
            // Name ergibt sich dann aus dem Pfad
        }
        if (name == null || name.isEmpty()) name = uri.getLastPathSegment();
        if (name == null || name.isEmpty()) name = "geteilt";
        // Pfadtrenner entfernen, damit nichts außerhalb des Cache-Ordners landet.
        return name.replaceAll("[/\\\\]", "_");
    }
}
