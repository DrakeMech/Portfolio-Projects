/**
 * Transformation Editor - manages custom transformations in browser
 * Communicates with launcher for testing and application
 */

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    loadCustomTransformations();
    loadBuiltInTransformations();
    updateConnectionStatus();
    
    // Poll connection status
    setInterval(updateConnectionStatus, 3000);
});


// ============================================================================
// CONNECTION STATUS
// ============================================================================

async function updateConnectionStatus() {
    try {
        const indicator = document.getElementById('statusIndicator');
        const text = document.getElementById('statusText');
        
        // Try to fetch something from the server
        const response = await fetch('http://localhost:8080/');
        
        if (response.ok) {
            indicator.className = 'status-indicator connected';
            text.textContent = 'Connected';
        } else {
            indicator.className = 'status-indicator disconnected';
            text.textContent = 'Disconnected';
        }
    } catch (e) {
        const indicator = document.getElementById('statusIndicator');
        const text = document.getElementById('statusText');
        indicator.className = 'status-indicator disconnected';
        text.textContent = 'Disconnected';
    }
}


// ============================================================================
// CUSTOM TRANSFORMATIONS
// ============================================================================

function loadCustomTransformations() {
    const stored = localStorage.getItem('customTransformations');
    if (stored) {
        document.getElementById('customCode').value = stored;
    }
}

function saveCustomTransformations() {
    const code = document.getElementById('customCode').value;
    
    if (!code.trim()) {
        showStatus('Custom code is empty', 'error');
        return;
    }
    
    // Save to browser storage
    localStorage.setItem('customTransformations', code);
    
    // Save to file on server (optional, if launcher provides endpoint)
    // For now, just confirm
    showStatus('Transformations saved locally (update launcher to apply)', 'success');
}

function resetCustomCode() {
    if (confirm('Reset custom transformations to empty?')) {
        document.getElementById('customCode').value = '';
        localStorage.removeItem('customTransformations');
        showStatus('Reset complete', 'info');
    }
}

function showStatus(message, type = 'info') {
    const statusDiv = document.getElementById('saveStatus');
    
    let color = '#888';
    if (type === 'success') color = '#00ff00';
    if (type === 'error') color = '#ff4444';
    if (type === 'info') color = '#00aaff';
    
    statusDiv.textContent = message;
    statusDiv.style.color = color;
    
    // Clear after 3 seconds
    if (type !== 'error') {
        setTimeout(() => {
            statusDiv.textContent = '';
        }, 3000);
    }
}


// ============================================================================
// BUILT-IN TRANSFORMATIONS (REFERENCE)
// ============================================================================

async function loadBuiltInTransformations() {
    // Mock built-in transformations - in real implementation, fetch from launcher
    const builtIns = {
        'passthrough(value)': 'Return value as-is, clamped to 0-127',
        'normalize_to_cc(value, min_val=0, max_val=100)': 'Normalize value from a range to MIDI CC range (0-127)',
        'threshold(value, threshold=50, below=0, above=127)': 'Binary transformation based on threshold',
        'exponential_curve(value, factor=2.0)': 'Apply exponential curve (steeper response)',
        'logarithmic_curve(value, factor=1.0)': 'Apply logarithmic curve (gentler response)',
        'invert(value)': 'Invert value: 127 - value',
        'smooth_average(value, history_buffer)': 'Smooth value using moving average',
        'deadzone(value, deadzone_size=5)': 'Apply deadzone: values in range snap to 0'
    };
    
    const list = document.getElementById('builtInList');
    let html = '';
    
    for (const [name, description] of Object.entries(builtIns)) {
        html += `
            <div class="transformation-item">
                <strong style="color: #00ff00;">${name}</strong><br/>
                <span style="color: #aaa;">${description}</span>
            </div>
        `;
    }
    
    list.innerHTML = html;
}


// ============================================================================
// TESTING
// ============================================================================

function testTransformation() {
    document.getElementById('testOutput').style.display = 'none';
}

function runTest() {
    const funcName = document.getElementById('testFunctionName').value;
    const testValue = parseFloat(document.getElementById('testValue').value);
    
    if (!funcName) {
        showStatus('Enter function name', 'error');
        return;
    }
    
    if (isNaN(testValue)) {
        showStatus('Enter a valid number', 'error');
        return;
    }
    
    // For now, show a message that testing requires the launcher
    const output = `
To test transformations:
1. Save your custom code using "Save Transformations"
2. Open the launcher desktop app
3. Create a mapping using your function
4. The launcher will test it with real sensor data

This web interface is for editing only.
Testing happens in the launcher where MIDI output is active.
    `;
    
    showTestOutput(output);
}

function showTestOutput(result) {
    const div = document.getElementById('testOutput');
    const pre = document.getElementById('testOutputValue');
    pre.textContent = result;
    div.style.display = 'block';
}
