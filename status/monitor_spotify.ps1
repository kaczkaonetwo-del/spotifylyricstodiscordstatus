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

$manager = Await-Operation ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ($ManagerType)

$lastTitle = ""
$lastArtist = ""
$lastPosition = -1
$lastIsPlaying = $false

# Keep stdout encoding as UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

while ($true) {
    try {
        $session = $manager.GetCurrentSession()
        if ($null -ne $session) {
            $playbackInfo = $session.GetPlaybackInfo()
            $isPlaying = $playbackInfo.PlaybackStatus -eq [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionPlaybackStatus]::Playing
            
            $mediaProperties = Await-Operation ($session.TryGetMediaPropertiesAsync()) ($PropertiesType)
            $timeline = $session.GetTimelineProperties()
            
            $title = $mediaProperties.Title
            $artist = $mediaProperties.Artist
            $position = $timeline.Position.TotalSeconds
            $duration = $timeline.EndTime.TotalSeconds
            
            # Print update if anything changed substantially (or every second to keep time synced)
            # We print if the song changed, if play/pause state changed, or if position jumped/updated
            if ($title -ne $lastTitle -or $artist -ne $lastArtist -or $isPlaying -ne $lastIsPlaying -or [Math]::Abs($position - $lastPosition) -gt 1.5) {
                $update = [PSCustomObject]@{
                    Status    = "active"
                    App       = $session.SourceAppUserModelId
                    Title     = $title
                    Artist    = $artist
                    IsPlaying = $isPlaying
                    Position  = $position
                    Duration  = $duration
                }
                $update | ConvertTo-Json -Compress
                $lastTitle = $title
                $lastArtist = $artist
                $lastIsPlaying = $isPlaying
                $lastPosition = $position
            }
        } else {
            if ($lastTitle -ne "") {
                $update = [PSCustomObject]@{
                    Status = "inactive"
                }
                $update | ConvertTo-Json -Compress
                $lastTitle = ""
                $lastArtist = ""
                $lastIsPlaying = $false
                $lastPosition = -1
            }
        }
    } catch {
        # Silent error, retry
    }
    Start-Sleep -Milliseconds 500
}
