package de.papaerless.app;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import android.widget.Toast;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ShareTargetPlugin.class);
        registerPlugin(AppLockPlugin.class);
        super.onCreate(savedInstanceState);
        Toast.makeText(this, "Build: Teilen-Diagnose 3", Toast.LENGTH_LONG).show();
        Log.i("ShareTarget", "onCreate action=" + (getIntent() == null ? null : getIntent().getAction()));
        handleShare(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        Log.i("ShareTarget", "onNewIntent action=" + (intent == null ? null : intent.getAction()));
        handleShare(intent);
    }

    private void handleShare(Intent intent) {
        if (getBridge() == null || getBridge().getPlugin("ShareTarget") == null) {
            Toast.makeText(this, "Teilen: Plugin nicht geladen", Toast.LENGTH_LONG).show();
            return;
        }
        ShareTargetPlugin plugin = (ShareTargetPlugin) getBridge().getPlugin("ShareTarget").getInstance();
        plugin.handleIntent(intent);
    }
}
