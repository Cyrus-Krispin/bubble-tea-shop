import type { Meta, StoryObj } from "@storybook/react-vite";
import { CircleCheck, Info, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "./alert";
import { Badge } from "./badge";
import { Button } from "./button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card";
import { Checkbox } from "./checkbox";
import { Input } from "./input";
import { Label } from "./label";
import { NativeSelect, NativeSelectOption } from "./native-select";
import { RadioGroup, RadioGroupItem } from "./radio-group";
import { Separator } from "./separator";
import { Skeleton } from "./skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";
import { Textarea } from "./textarea";

const meta = {
  parameters: { layout: "fullscreen" },
  title: "Design System/Dark theme specimen",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Complete: Story = {
  render: () => (
    <main className="space-y-8">
      <header className="space-y-2">
        <Badge variant="outline">Obsidian-inspired</Badge>
        <h1 className="text-3xl font-semibold tracking-tight">Bubble Tea Shop interface system</h1>
        <p className="max-w-2xl text-muted-foreground">
          Neutral charcoal surfaces keep the interface quiet while ube marks actions, focus, and selection.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Theme surfaces">
        {[
          ["Canvas", "bg-background"],
          ["Card", "bg-card"],
          ["Raised", "bg-popover"],
          ["Selected", "bg-accent"],
        ].map(([label, color]) => (
          <div className={`${color} rounded-lg border p-4`} key={label}>
            <strong>{label}</strong>
            <p className="mt-1 text-sm text-muted-foreground">Semantic surface token</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Actions and status</CardTitle>
            <CardDescription>Primary emphasis stays scarce and unmistakable.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button size="regular">Save changes</Button>
            <Button size="regular" variant="secondary">Cancel</Button>
            <Button size="regular" variant="outline">View receipt</Button>
            <Button size="regular" variant="danger">Deactivate</Button>
            <Badge><CircleCheck data-icon="inline-start" /> Ready</Badge>
            <Badge variant="secondary">Pending</Badge>
            <Badge variant="destructive">Shortage</Badge>
          </CardContent>
          <CardFooter className="gap-2 text-muted-foreground">
            <Info className="size-4" aria-hidden="true" /> Keyboard focus uses the ube ring.
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Form controls</CardTitle>
            <CardDescription>Customer controls retain comfortable 44px targets.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="theme-name">Drink name</Label>
              <Input className="h-11" id="theme-name" defaultValue="Ube Cloud Milk Tea" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="theme-location">Pickup location</Label>
              <NativeSelect className="w-full" id="theme-location">
                <NativeSelectOption>Orchard Central</NativeSelectOption>
                <NativeSelectOption>Tiong Bahru</NativeSelectOption>
              </NativeSelect>
            </div>
            <Textarea aria-label="Order note" placeholder="Order note" />
            <div className="flex flex-wrap gap-5">
              <Label className="flex min-h-11 items-center gap-2 px-1"><Checkbox defaultChecked /> Add pearls</Label>
              <RadioGroup className="flex w-auto gap-4" defaultValue="regular">
                <Label className="flex min-h-11 items-center gap-2 px-1"><RadioGroupItem value="regular" /> Regular</Label>
                <Label className="flex min-h-11 items-center gap-2 px-1"><RadioGroupItem value="large" /> Large</Label>
              </RadioGroup>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Alert><CircleCheck /><AlertTitle>Order ready</AlertTitle><AlertDescription>Cash due at pickup: S$8.40</AlertDescription></Alert>
        <Alert><Info /><AlertTitle>Inventory updated</AlertTitle><AlertDescription>Receipt movement recorded.</AlertDescription></Alert>
        <Alert variant="destructive"><TriangleAlert /><AlertTitle>Stock shortage</AlertTitle><AlertDescription>Complete the replenishment first.</AlertDescription></Alert>
      </section>

      <Separator />

      <section className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <Card size="sm">
          <CardHeader><CardTitle>Operational data</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Ingredient</TableHead><TableHead>Balance</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                <TableRow><TableCell>Assam tea</TableCell><TableCell>4,000 g</TableCell><TableCell><Badge variant="secondary">Ready</Badge></TableCell></TableRow>
                <TableRow><TableCell>Tapioca pearls</TableCell><TableCell>850 g</TableCell><TableCell><Badge variant="destructive">Low</Badge></TableCell></TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <div className="space-y-3 rounded-xl border bg-card p-4" aria-label="Loading preview">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="aspect-[4/3] w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </section>
    </main>
  ),
};
