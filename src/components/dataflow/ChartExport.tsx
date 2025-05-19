
"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ChartExportProps {
  svgRef: React.RefObject<SVGSVGElement | null>;
  fileName?: string;
}

export function ChartExport({ svgRef, fileName = "chart" }: ChartExportProps) {
  const { toast } = useToast();

  const handleExport = () => {
    if (svgRef.current) {
      const svgElement = svgRef.current;
      const serializer = new XMLSerializer();
      let svgString = serializer.serializeToString(svgElement);

      // Add XML namespace if missing, crucial for direct SVG viewing/editing
      if(!svgString.match(/^<svg[^>]+"http:\/\/www\\.w3\\.org\/2000\/svg"/)){
        svgString = svgString.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
      }
      
      const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileName.split('.')[0] || 'chart'}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: "Chart Exported",
        description: "Chart downloaded as SVG.",
      });
    } else {
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "No chart available to export or chart reference is missing.",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-6 w-6 text-primary" />
          Export Chart
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Button onClick={handleExport} className="w-full" variant="outline">
          Download as SVG
        </Button>
      </CardContent>
    </Card>
  );
}
