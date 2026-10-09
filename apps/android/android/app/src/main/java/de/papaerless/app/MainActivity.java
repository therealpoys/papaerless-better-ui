package de.papaerless.app;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ShareTargetPlugin.class);
        super.onCreate(savedInstanceState);
        handleShare(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleShare(intent);
    }

    private void handleShare(Intent intent) {
        if (getBridge() == null || getBridge().getPlugin("ShareTarget") == null) return;
        ShareTargetPlugin plugin = (ShareTargetPlugin) getBridge().getPlugin("ShareTarget").getInstance();
        plugin.handleIntent(intent);
    }
}
