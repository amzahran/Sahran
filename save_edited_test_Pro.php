<?php
header('Content-Type: text/plain');
$input = json_decode(file_get_contents("php://input"), true);

$serverName = "ahmedzahran\SQL";
$connectionInfo = ["Database" => "platform", "UID" => "sa", "PWD" => "123123"];
$conn = sqlsrv_connect($serverName, $connectionInfo);

if (!$conn) {
    die(print_r(sqlsrv_errors(), true));
}

$testID = $input["TestID"];
$testTitle = $input["TestTitle"];
$testType = $input["TestType"];
$category = $input["CategoryTest"];
$price = $input["Price"];
$sections = $input["Sections"];

// تحديث بيانات الاختبار الأساسية
$updateTest = "UPDATE Tests SET TestTitle = ?, TestType = ?, CategoryTest = ?, Price = ? WHERE TestID = ?";
$paramsTest = [$testTitle, $testType, $category, $price, $testID];
$stmt = sqlsrv_query($conn, $updateTest, $paramsTest);
if ($stmt === false) die(print_r(sqlsrv_errors(), true));

// حذف البيانات القديمة
sqlsrv_query($conn, "DELETE FROM AnswerOptions WHERE QuestionID IN (SELECT QuestionID FROM Questions WHERE SectionID IN (SELECT SectionID FROM Sections WHERE TestID = ?))", [$testID]);
sqlsrv_query($conn, "DELETE FROM Questions WHERE SectionID IN (SELECT SectionID FROM Sections WHERE TestID = ?)", [$testID]);
sqlsrv_query($conn, "DELETE FROM Sections WHERE TestID = ?", [$testID]);

foreach ($sections as $section) {
    $insertSection = sqlsrv_query($conn,
        "INSERT INTO Sections (TestID, SectionNumber, Duration, NumberOfQuestions, SectionTitle) OUTPUT INSERTED.SectionID VALUES (?, ?, ?, ?, ?)",
        [$testID, $section["SectionNumber"], $section["Duration"], $section["NumberOfQuestions"], $section["SectionTitle"]]
    );
    if ($insertSection === false) die(print_r(sqlsrv_errors(), true));
    $row = sqlsrv_fetch_array($insertSection, SQLSRV_FETCH_ASSOC);
    $sectionID = $row["SectionID"];

    foreach ($section["Questions"] as $question) {
        $insertQ = sqlsrv_query($conn,
            "INSERT INTO Questions (SectionID, QuestionText, QuestionType) OUTPUT INSERTED.QuestionID VALUES (?, ?, ?)",
            [$sectionID, $question["QuestionText"], $question["QuestionType"]]
        );
        if ($insertQ === false) die(print_r(sqlsrv_errors(), true));
        $qRow = sqlsrv_fetch_array($insertQ, SQLSRV_FETCH_ASSOC);
        $questionID = $qRow["QuestionID"];

        foreach ($question["Options"] as $opt) {
            $insertOpt = sqlsrv_query($conn,
                "INSERT INTO AnswerOptions (QuestionID, OptionText, IsCorrect) VALUES (?, ?, ?)",
                [$questionID, $opt["OptionText"], $opt["IsCorrect"] ? 1 : 0]
            );
            if ($insertOpt === false) die(print_r(sqlsrv_errors(), true));
        }
    }
}

echo "✅ Test updated successfully.";
?>
