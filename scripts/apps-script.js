function listAllFiles() {
  var folderId = '1QZRHWec4VW62TLH9vHrNiFa-cQeWKxcM';
  var result = [];
  
  function scanFolder(id, path) {
    var folder = DriveApp.getFolderById(id);
    var files = folder.getFiles();
    while (files.hasNext()) {
      var f = files.next();
      result.push({
        id: f.getId(),
        name: f.getName(),
        path: path + '/' + f.getName()
      });
    }
    var subs = folder.getFolders();
    while (subs.hasNext()) {
      var sub = subs.next();
      scanFolder(sub.getId(), path + '/' + sub.getName());
    }
  }
  
  scanFolder(folderId, '');
  
  // Mentés a face mappába (folderId)
  var output = JSON.stringify(result, null, 2);
  var folder = DriveApp.getFolderById(folderId);
  
  // Ha már létezik töröljük
  var existing = folder.getFilesByName('drive_files.json');
  while (existing.hasNext()) existing.next().setTrashed(true);
  
  var file = folder.createFile('drive_files.json', output, 'application/json');
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  Logger.log('Kész! ' + result.length + ' fájl');
  Logger.log('Link: https://drive.google.com/file/d/' + file.getId());
}
