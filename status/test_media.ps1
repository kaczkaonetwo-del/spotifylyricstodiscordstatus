try {
    # Load Windows Runtime types
    $ManagerType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType=WindowsRuntime]
    $PropertiesType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType=WindowsRuntime]
    
    # Load Windows Runtime async helpers
    [void][System.Reflection.Assembly]::LoadWithPartialName("System.Runtime.WindowsRuntime")
    $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { 
        $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' 
    })[0]
    
    function Await-Operation {
        param($WinRtTask, $ResultType)
        $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
        $netTask = $asTask.Invoke($null, @($WinRtTask))
        $netTask.Wait(-1) | Out-Null
        return $netTask.Result
    }
    
    # Retrieve the manager
    $manager = Await-Operation ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ($ManagerType)
    $sessions = $manager.GetSessions()
    
    if ($sessions.Count -eq 0) {
        Write-Host "No active media sessions found."
        exit
    }
    
    foreach ($session in $sessions) {
        $mediaProperties = Await-Operation ($session.TryGetMediaPropertiesAsync()) ($PropertiesType)
        $timeline = $session.GetTimelineProperties()
        [PSCustomObject]@{
            App = $session.SourceAppUserModelId
            Title = $mediaProperties.Title
            Artist = $mediaProperties.Artist
            PositionSeconds = $timeline.Position.TotalSeconds
            DurationSeconds = $timeline.EndTime.TotalSeconds
        } | ConvertTo-Json
    }
} catch {
    Write-Error $_.Exception.Message
}
